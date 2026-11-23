// Taking a test. The server owns the clock and the answer key:
// correct_index and explanation are only returned after submission.
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db, dbTx } from './db';
import { skillRecords, studentProfiles, testAttempts, testQuestions } from './db/schema';
import { GRACE_SEC, TAB_SWITCH_FLAG, TAB_SWITCH_WARN, TEST_DURATION_SEC, VERIFICATION_MONTHS } from './testConfig';
import { retakeStatus, scoreAttempt } from '@/lib/scoring';
import { findReadyAttempt } from './testGen';

const addMonths = (d: Date, m: number) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
};

async function ownAttempt(studentId: string, attemptId: string) {
  const [a] = await db
    .select()
    .from(testAttempts)
    .where(and(eq(testAttempts.id, attemptId), eq(testAttempts.studentId, studentId)));
  return a ?? null;
}

const deadlineOf = (startedAt: Date) => new Date(startedAt.getTime() + (TEST_DURATION_SEC + GRACE_SEC) * 1000);

export class TestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Start (or resume) the student's test. */
export async function startTest(studentId: string) {
  const [inProgress] = await db
    .select({ id: testAttempts.id })
    .from(testAttempts)
    .where(and(eq(testAttempts.studentId, studentId), eq(testAttempts.status, 'in_progress')));
  if (inProgress) return { attemptId: inProgress.id };

  const submitted = await db
    .select({ at: testAttempts.submittedAt })
    .from(testAttempts)
    .where(and(eq(testAttempts.studentId, studentId), inArray(testAttempts.status, ['submitted', 'flagged'])));
  const retake = retakeStatus(submitted.map((s) => s.at!).filter(Boolean));
  if (!retake.allowed) throw new TestError(retake.reason ?? 'You cannot start a new attempt yet.', 409);

  const ready = await findReadyAttempt(studentId);
  if (!ready) return { attemptId: null };
  await db.update(testAttempts).set({ status: 'in_progress', startedAt: new Date() }).where(eq(testAttempts.id, ready));
  return { attemptId: ready };
}

/** Auto-submit if the server deadline has passed. Returns true if it submitted. */
async function enforceDeadline(studentId: string, attempt: typeof testAttempts.$inferSelect) {
  if (attempt.status === 'in_progress' && attempt.startedAt && deadlineOf(attempt.startedAt) < new Date()) {
    await submitTest(studentId, attempt.id, true);
    return true;
  }
  return false;
}

/** What the client sees while taking the test (no answer key). */
export async function getTestForClient(studentId: string, attemptId: string) {
  const a = await ownAttempt(studentId, attemptId);
  if (!a) throw new TestError('Test not found.', 404);
  if (await enforceDeadline(studentId, a)) return { status: 'submitted' as const };
  if (a.status !== 'in_progress') return { status: a.status };
  const qs = await db
    .select({
      id: testQuestions.id,
      idx: testQuestions.idx,
      skill: testQuestions.skill,
      question: testQuestions.question,
      options: testQuestions.options,
      answer: testQuestions.studentAnswer,
      marked: testQuestions.markedForReview,
    })
    .from(testQuestions)
    .where(eq(testQuestions.attemptId, attemptId))
    .orderBy(asc(testQuestions.idx));
  return {
    status: 'in_progress' as const,
    questions: qs,
    endsAt: new Date(a.startedAt!.getTime() + TEST_DURATION_SEC * 1000).toISOString(),
    serverNow: new Date().toISOString(),
    tabSwitches: a.tabSwitches,
    warnAt: TAB_SWITCH_WARN,
    flagAt: TAB_SWITCH_FLAG,
  };
}

/** Autosave one answer (and the review flag). */
export async function saveAnswer(studentId: string, attemptId: string, questionId: string, answer: number | null, marked?: boolean) {
  const a = await ownAttempt(studentId, attemptId);
  if (!a) throw new TestError('Test not found.', 404);
  if (await enforceDeadline(studentId, a)) throw new TestError('Time is up. Your test was submitted.', 409);
  if (a.status !== 'in_progress') throw new TestError('This test is no longer in progress.', 409);
  const set: Partial<typeof testQuestions.$inferInsert> = { studentAnswer: answer };
  if (marked !== undefined) set.markedForReview = marked;
  const r = await db
    .update(testQuestions)
    .set(set)
    .where(and(eq(testQuestions.id, questionId), eq(testQuestions.attemptId, attemptId)))
    .returning({ id: testQuestions.id });
  if (!r.length) throw new TestError('Question not found.', 404);
}

/** Tab switch / paste event: counted towards the integrity limit. */
export async function recordIntegrityEvent(studentId: string, attemptId: string) {
  const a = await ownAttempt(studentId, attemptId);
  if (!a || a.status !== 'in_progress') return { tabSwitches: a?.tabSwitches ?? 0 };
  const tabSwitches = a.tabSwitches + 1;
  await db
    .update(testAttempts)
    .set({ tabSwitches, flagged: tabSwitches >= TAB_SWITCH_FLAG })
    .where(eq(testAttempts.id, attemptId));
  return { tabSwitches, warn: tabSwitches >= TAB_SWITCH_WARN, flagged: tabSwitches >= TAB_SWITCH_FLAG };
}

/** Score the attempt and update skill records + verification status. */
export async function submitTest(studentId: string, attemptId: string, auto = false) {
  const a = await ownAttempt(studentId, attemptId);
  if (!a) throw new TestError('Test not found.', 404);
  if (a.status === 'submitted' || a.status === 'flagged') return { alreadySubmitted: true };
  if (a.status !== 'in_progress') throw new TestError('This test was never started.', 409);

  const qs = await db.select().from(testQuestions).where(eq(testQuestions.attemptId, attemptId));
  const graded = qs.map((q) => ({ id: q.id, skill: q.skill, isCorrect: q.studentAnswer === q.correctIndex }));
  const r = scoreAttempt(graded, a.tabSwitches);
  const now = new Date();
  const expires = addMonths(now, VERIFICATION_MONTHS);

  await dbTx().transaction(async (tx) => {
    for (const q of graded) await tx.update(testQuestions).set({ isCorrect: q.isCorrect }).where(eq(testQuestions.id, q.id));
    await tx
      .update(testAttempts)
      .set({
        status: r.flagged ? 'flagged' : 'submitted',
        submittedAt: now,
        durationSec: Math.min(TEST_DURATION_SEC + GRACE_SEC, Math.round((now.getTime() - a.startedAt!.getTime()) / 1000)),
        correct: r.correct,
        scorePct: r.scorePct,
        verified: r.verified,
        distinction: r.distinction,
        flagged: r.flagged,
        skills: r.skills,
      })
      .where(eq(testAttempts.id, attemptId));

    // A flagged attempt grants nothing and changes nothing.
    if (r.flagged) return;
    for (const s of r.skills) {
      const values = {
        tested: true,
        verified: s.verified,
        scorePct: s.scorePct,
        questionsCorrect: s.correct,
        questionsTotal: s.total,
        lastTestedAt: now,
        expiresAt: s.verified ? expires : null,
      };
      await tx
        .insert(skillRecords)
        .values({ studentId, skill: s.skill, ...values })
        .onConflictDoUpdate({ target: [skillRecords.studentId, skillRecords.skill], set: values });
    }
    const [p] = await tx.select().from(studentProfiles).where(eq(studentProfiles.userId, studentId));
    const stillVerified = !!p?.verified && !!p.verifiedUntil && p.verifiedUntil > now;
    if (r.verified) {
      await tx
        .update(studentProfiles)
        .set({ verified: true, distinction: r.distinction, verifiedUntil: expires, testScorePct: r.scorePct, updatedAt: now })
        .where(eq(studentProfiles.userId, studentId));
    } else if (!stillVerified) {
      // A failed retake never removes an existing, unexpired verification.
      await tx
        .update(studentProfiles)
        .set({ testScorePct: r.scorePct, verified: false, distinction: false, visibleToCompanies: false, updatedAt: now })
        .where(eq(studentProfiles.userId, studentId));
    }
  });
  return { alreadySubmitted: false, auto };
}

/** Result screen (only after submission): score, per-skill bars, explanations. */
export async function getResult(studentId: string, attemptId: string) {
  const a = await ownAttempt(studentId, attemptId);
  if (!a) throw new TestError('Test not found.', 404);
  if (await enforceDeadline(studentId, a)) return getResult(studentId, attemptId);
  if (a.status !== 'submitted' && a.status !== 'flagged') throw new TestError('Results are available after you submit.', 409);
  const qs = await db.select().from(testQuestions).where(eq(testQuestions.attemptId, attemptId)).orderBy(asc(testQuestions.idx));
  const submitted = await db
    .select({ at: testAttempts.submittedAt })
    .from(testAttempts)
    .where(and(eq(testAttempts.studentId, studentId), inArray(testAttempts.status, ['submitted', 'flagged'])));
  const retake = retakeStatus(submitted.map((s) => s.at!).filter(Boolean));
  return {
    id: a.id,
    status: a.status,
    correct: a.correct,
    total: a.totalQ,
    scorePct: a.scorePct,
    verified: a.verified,
    distinction: a.distinction,
    flagged: a.flagged,
    tabSwitches: a.tabSwitches,
    durationSec: a.durationSec,
    submittedAt: a.submittedAt?.toISOString() ?? null,
    skills: a.skills,
    nextAttemptAt: retake.nextAt?.toISOString() ?? null,
    review: qs.map((q) => ({
      idx: q.idx,
      skill: q.skill,
      difficulty: q.difficulty,
      question: q.question,
      options: q.options,
      answer: q.studentAnswer,
      correctIndex: q.correctIndex,
      isCorrect: q.isCorrect,
      explanation: q.explanation,
    })),
  };
}
