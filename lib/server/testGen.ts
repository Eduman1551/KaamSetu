// Skills-test generation. Stateless (serverless-safe): an attempt row with status
// 'generating' is the lock and holds the progress; the whole generation runs inside the
// POST /api/test/prepare request (maxDuration 300 s). Nothing is sent to the client here.
import { and, eq, inArray, lt } from 'drizzle-orm';
import { db, dbTx } from './db';
import { analyses, testAttempts, testQuestions } from './db/schema';
import { env } from './env';
import { chatJSON } from './groq';
import { isLimited, record } from './rateLimit';
import { GENERATIONS_PER_HOUR, MIN_CORE_SKILLS, READY_TEST_TTL_HOURS } from './testConfig';
import { questionSplit, retakeStatus } from '@/lib/scoring';
import { displaySkill } from '@/lib/skillNames';
import {
  GeneratedSchema,
  SolvedSchema,
  difficultyPlan,
  makeVerifiedQuestions,
  shuffle,
  shuffleOptions,
  questionHash,
  type Deps,
  type Question,
} from './questionFactory';

export interface GenerationProgress {
  done: number;
  total: number;
  error: string | null;
}

/** A 'generating' row older than this is a crashed/timed-out run and is discarded. */
const STALE_GENERATION_MS = 6 * 60_000;

/** The Groq-backed generator + blind solver. */
export const groqDeps: Deps = {
  generate: ({ skill, difficulties, angle, avoidStems }) =>
    chatJSON({
      model: env.modelMain,
      schema: GeneratedSchema,
      maxTokens: 400 + difficulties.length * 450,
      system:
        'You write hard, fair multiple-choice questions that test real working skill for engineers 0-2 years into their career. Reply with JSON only.',
      user: `Skill: ${displaySkill(skill)}
Write exactly ${difficulties.length} questions, with these difficulties in order: ${difficulties.join(', ')}.${angle ? `\nUse a different angle this time: ${angle}.` : ''}
Rules:
- 4 options, exactly one correct. Plausible distractors that a half-prepared person would pick.
- Each question is a realistic scenario, code-output prediction, debugging task, or trade-off decision. Include a short code snippet or data example when it helps.
- NO pure definitions or trivia, no "all of the above", "none of the above" or "both".
- medium = solid fundamentals; hard = needs real practice; expert = subtle edge cases or design judgement.
- explanation: 1-2 sentences on why the correct option is right. Never refer to option letters or positions ("the first one"): options are shuffled.
- The answer must be unambiguous and verifiable.${avoidStems.length ? `\nDo NOT repeat these questions:\n- ${avoidStems.join('\n- ')}` : ''}
JSON: {"questions":[{"question":"","options":["","","",""],"correctIndex":0,"explanation":"","difficulty":"hard"}]}`,
    }),
  solve: (skill, qs) =>
    chatJSON({
      model: env.modelFast,
      schema: SolvedSchema,
      maxTokens: 200 + qs.length * 60,
      system: 'You are an expert taking a test. Solve each question independently and carefully. Reply with JSON only.',
      user: `Skill: ${displaySkill(skill)}
${qs.map((q, i) => `Q${i + 1}. ${q.question}\n${q.options.map((o, j) => `  ${j}) ${o}`).join('\n')}`).join('\n\n')}

For each question give the index (0-3) of the single correct option. Set "ambiguous": true if more than one option could be right or none is.
JSON: {"answers":[{"answer":0,"ambiguous":false}]}`,
    }),
};

/** Expire 'ready' tests older than 24 h and drop stale 'generating' rows. */
export async function expireStaleReady(studentId: string) {
  const cutoff = new Date(Date.now() - READY_TEST_TTL_HOURS * 3600_000);
  await db
    .update(testAttempts)
    .set({ status: 'expired' })
    .where(and(eq(testAttempts.studentId, studentId), eq(testAttempts.status, 'ready'), lt(testAttempts.generatedAt, cutoff)));
  await db
    .delete(testAttempts)
    .where(and(eq(testAttempts.studentId, studentId), eq(testAttempts.status, 'generating'), lt(testAttempts.generatedAt, new Date(Date.now() - STALE_GENERATION_MS))));
}

export async function findReadyAttempt(studentId: string) {
  await expireStaleReady(studentId);
  const [a] = await db
    .select({ id: testAttempts.id })
    .from(testAttempts)
    .where(and(eq(testAttempts.studentId, studentId), eq(testAttempts.status, 'ready')));
  return a?.id ?? null;
}

/** Progress of a test being prepared right now (read from the DB), or null. */
export async function generationProgress(studentId: string): Promise<GenerationProgress | null> {
  const [a] = await db
    .select({ progress: testAttempts.progress, total: testAttempts.totalQ, at: testAttempts.generatedAt })
    .from(testAttempts)
    .where(and(eq(testAttempts.studentId, studentId), eq(testAttempts.status, 'generating')));
  if (!a || Date.now() - a.at.getTime() > STALE_GENERATION_MS) return null;
  return { done: a.progress, total: a.total, error: null };
}

export type PrepareResult = { status: 'ready' | 'generating' | 'blocked'; reason?: string };

/**
 * Make sure the student has a ready test. Generates it inside this request when
 * needed (2 skills in parallel, Groq limits). Safe to call repeatedly.
 */
export async function prepareTest(studentId: string, deps: Deps = groqDeps): Promise<PrepareResult> {
  const [an] = await db.select({ result: analyses.result }).from(analyses).where(eq(analyses.studentId, studentId));
  const core = an?.result.coreSkills ?? [];
  if (core.length < MIN_CORE_SKILLS) return { status: 'blocked', reason: 'Add more skills to your resume to unlock verification.' };
  if (await findReadyAttempt(studentId)) return { status: 'ready' };
  if (await generationProgress(studentId)) return { status: 'generating' };

  const submitted = await db
    .select({ at: testAttempts.submittedAt })
    .from(testAttempts)
    .where(and(eq(testAttempts.studentId, studentId), inArray(testAttempts.status, ['submitted', 'flagged'])));
  const retake = retakeStatus(submitted.map((s) => s.at!).filter(Boolean));
  if (!retake.allowed) return { status: 'blocked', reason: retake.reason };

  const key = `testgen:${studentId}`;
  if (await isLimited(key, GENERATIONS_PER_HOUR, 3600_000)) {
    return { status: 'blocked', reason: 'Test generation limit reached (3 per hour). Please try again later.' };
  }
  await record(key, 3600_000);

  const split = questionSplit(core.length);
  const skills = core.slice(0, split.length);
  const total = split.reduce((a, b) => a + b, 0);
  // The 'generating' row is the lock + progress record.
  const [lock] = await db
    .insert(testAttempts)
    .values({
      studentId,
      status: 'generating',
      totalQ: total,
      progress: 0,
      skills: skills.map((s, i) => ({ skill: s, correct: 0, total: split[i], scorePct: 0, verified: false })),
    })
    .returning({ id: testAttempts.id });

  try {
    const seen = await db
      .select({ h: testQuestions.questionHash })
      .from(testQuestions)
      .innerJoin(testAttempts, eq(testAttempts.id, testQuestions.attemptId))
      .where(eq(testAttempts.studentId, studentId));
    const seenHashes = new Set(seen.map((x) => x.h));
    const plan = difficultyPlan(split);
    let done = 0;
    const results: Question[][] = new Array(skills.length);
    let next = 0;
    const worker = async () => {
      while (next < skills.length) {
        const i = next++;
        results[i] = await makeVerifiedQuestions(skills[i], plan[i], seenHashes, deps, () => {
          done++;
        });
        await db.update(testAttempts).set({ progress: done }).where(eq(testAttempts.id, lock.id));
      }
    };
    await Promise.all([worker(), worker()]);

    // Shuffle question order and options server-side for this attempt.
    const all = shuffle(results.flat()).map(shuffleOptions);
    await dbTx().transaction(async (tx) => {
      await tx.insert(testQuestions).values(
        all.map((q, idx) => ({
          attemptId: lock.id,
          idx,
          skill: q.skill,
          difficulty: q.difficulty,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          questionHash: questionHash(q),
        })),
      );
      await tx.update(testAttempts).set({ status: 'ready', progress: all.length, generatedAt: new Date() }).where(eq(testAttempts.id, lock.id));
    });
    return { status: 'ready' };
  } catch (err) {
    await db.delete(testAttempts).where(eq(testAttempts.id, lock.id));
    console.error('[testgen] failed:', err instanceof Error ? err.message : err);
    throw new Error('Your test could not be prepared right now. Please try again in a minute.');
  }
}
