// Skills-test generation: runs in the background after an analysis (or on demand)
// and stores a 'ready' attempt. Nothing is sent to the client here.
import { and, eq, inArray, lt } from 'drizzle-orm';
import { db } from './db';
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

const g = globalThis as unknown as { __ksGen?: Map<string, GenerationProgress & { running: boolean }> };
const jobs = g.__ksGen ?? (g.__ksGen = new Map());

export function generationProgress(studentId: string): GenerationProgress | null {
  const j = jobs.get(studentId);
  return j ? { done: j.done, total: j.total, error: j.error } : null;
}
export function isGenerating(studentId: string) {
  return !!jobs.get(studentId)?.running;
}

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

/** Expire 'ready' tests older than 24 h. */
export async function expireStaleReady(studentId: string) {
  const cutoff = new Date(Date.now() - READY_TEST_TTL_HOURS * 3600_000);
  await db
    .update(testAttempts)
    .set({ status: 'expired' })
    .where(and(eq(testAttempts.studentId, studentId), eq(testAttempts.status, 'ready'), lt(testAttempts.generatedAt, cutoff)));
}

export async function findReadyAttempt(studentId: string) {
  await expireStaleReady(studentId);
  const [a] = await db
    .select({ id: testAttempts.id })
    .from(testAttempts)
    .where(and(eq(testAttempts.studentId, studentId), eq(testAttempts.status, 'ready')));
  return a?.id ?? null;
}

type QueueResult = { queued: boolean; reason?: string };

/**
 * Start generating a test in the background (returns immediately).
 * Skips if one is ready/running, the student can't test yet, or limits are hit.
 */
export function queueTestGeneration(studentId: string): Promise<QueueResult> {
  return (async (): Promise<QueueResult> => {
    if (isGenerating(studentId)) return { queued: true };
    const [an] = await db.select({ result: analyses.result }).from(analyses).where(eq(analyses.studentId, studentId));
    const core = an?.result.coreSkills ?? [];
    if (core.length < MIN_CORE_SKILLS) return { queued: false, reason: 'Add more skills to your resume to unlock verification.' };
    if (await findReadyAttempt(studentId)) return { queued: false, reason: 'ready' };

    const submitted = await db
      .select({ at: testAttempts.submittedAt })
      .from(testAttempts)
      .where(and(eq(testAttempts.studentId, studentId), inArray(testAttempts.status, ['submitted', 'flagged'])));
    const retake = retakeStatus(submitted.map((s) => s.at!).filter(Boolean));
    if (!retake.allowed) return { queued: false, reason: retake.reason };

    const key = `testgen:${studentId}`;
    if (isLimited(key, GENERATIONS_PER_HOUR, 3600_000)) {
      return { queued: false, reason: 'Test generation limit reached (3 per hour). Please try again later.' };
    }
    record(key);
    const split = questionSplit(core.length);
    const total = split.reduce((a, b) => a + b, 0);
    jobs.set(studentId, { done: 0, total, error: null, running: true });
    void generate(studentId, core.slice(0, split.length), split).catch((err) => {
      const j = jobs.get(studentId);
      if (j) Object.assign(j, { running: false, error: err instanceof Error ? err.message : 'Could not prepare your test.' });
      console.error('[testgen] failed:', err instanceof Error ? err.message : err);
    });
    return { queued: true };
  })();
}

async function generate(studentId: string, skills: string[], split: number[], deps: Deps = groqDeps) {
  // Never reuse a question this student has already seen.
  const seen = await db
    .select({ h: testQuestions.questionHash })
    .from(testQuestions)
    .innerJoin(testAttempts, eq(testAttempts.id, testQuestions.attemptId))
    .where(eq(testAttempts.studentId, studentId));
  const seenHashes = new Set(seen.map((s) => s.h));
  const plan = difficultyPlan(split);
  const job = jobs.get(studentId)!;

  // At most 2 skills in parallel (Groq free-tier limits).
  const results: Question[][] = new Array(skills.length);
  let next = 0;
  const worker = async () => {
    while (next < skills.length) {
      const i = next++;
      results[i] = await makeVerifiedQuestions(skills[i], plan[i], seenHashes, deps, () => job.done++);
    }
  };
  await Promise.all([worker(), worker()]);

  // Shuffle question order and options server-side for this attempt.
  const all = shuffle(results.flat()).map(shuffleOptions);
  await db.transaction(async (tx) => {
    const [a] = await tx
      .insert(testAttempts)
      .values({
        studentId,
        status: 'ready',
        totalQ: all.length,
        skills: skills.map((s, i) => ({ skill: s, correct: 0, total: split[i], scorePct: 0, verified: false })),
      })
      .returning({ id: testAttempts.id });
    await tx.insert(testQuestions).values(
      all.map((q, idx) => ({
        attemptId: a.id,
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
  });
  jobs.set(studentId, { done: job.total, total: job.total, error: null, running: false });
}
