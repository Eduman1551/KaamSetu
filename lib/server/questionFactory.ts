// Generates hard MCQs for one skill and checks each one with a blind solver.
// The AI calls are injected (deps) so this file is unit-testable with mocks.
import crypto from 'crypto';
import { z } from 'zod';

export type Difficulty = 'medium' | 'hard' | 'expert';

export interface Question {
  skill: string;
  difficulty: Difficulty;
  question: string;
  options: string[]; // exactly 4
  correctIndex: number;
  explanation: string;
}

export const GeneratedSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().min(20).max(1500),
      options: z.array(z.string().min(1).max(300)).length(4),
      correctIndex: z.coerce.number().int().min(0).max(3),
      explanation: z.string().min(10).max(500),
      difficulty: z.enum(['medium', 'hard', 'expert']).catch('hard'),
    }),
  ),
});
export type Generated = z.infer<typeof GeneratedSchema>;

export const SolvedSchema = z.object({
  answers: z.array(z.object({ answer: z.coerce.number().int().min(-1).max(3), ambiguous: z.boolean().catch(false) })),
});
export type Solved = z.infer<typeof SolvedSchema>;

export interface GenRequest {
  skill: string;
  difficulties: Difficulty[];
  /** A different angle for regenerations, e.g. "debugging". */
  angle?: string;
  avoidStems: string[];
}

export interface Deps {
  generate: (req: GenRequest) => Promise<Generated>;
  solve: (skill: string, qs: { question: string; options: string[] }[]) => Promise<Solved>;
}

/** Stable fingerprint of a question, used to never repeat a question for a student. */
export function questionHash(q: { question: string; options: string[] }) {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/[^\w ]/g, '').trim();
  return crypto
    .createHash('sha256')
    .update(norm(q.question) + '|' + q.options.map(norm).sort().join('|'))
    .digest('hex');
}

/** Basic quality rules checked in code (on top of the prompt). */
export function passesRules(q: { question: string; options: string[] }) {
  const opts = q.options.map((o) => o.trim().toLowerCase());
  if (new Set(opts).size !== 4) return false; // duplicate options
  if (opts.some((o) => /\b(all|none|both) of the (above|these)\b/.test(o))) return false;
  if (/^\s*(what is|define|which of the following is the definition)\b/i.test(q.question) && q.question.length < 80) return false; // pure definition
  return true;
}

const ANGLES = ['a code-output prediction', 'a debugging scenario', 'a trade-off decision in a realistic project', 'a realistic workplace scenario'];

/**
 * Produce `difficulties.length` verified questions for one skill.
 * Each slot: generate -> blind-solve; on mismatch/ambiguity regenerate (max 2
 * retries), then drop and try other angles. Throws if a slot can't be filled.
 */
export async function makeVerifiedQuestions(
  skill: string,
  difficulties: Difficulty[],
  seenHashes: Set<string>,
  deps: Deps,
  onProgress?: () => void,
): Promise<Question[]> {
  const out: Question[] = [];
  const stems: string[] = [];

  /** Generate a batch, keep the ones that pass rules, hash checks and the blind solver. */
  const attempt = async (diffs: Difficulty[], angle?: string): Promise<Difficulty[]> => {
    const gen = await deps.generate({ skill, difficulties: diffs, angle, avoidStems: stems });
    const failed: Difficulty[] = [];
    const candidates: Question[] = [];
    diffs.forEach((d, i) => {
      const g = gen.questions[i];
      if (!g) return failed.push(d);
      // Some models send escaped newlines inside strings; turn them into real ones.
      const fix = (t: string) => t.replace(/\\n/g, '\n').replace(/\\t/g, '  ').trim();
      const q: Question = { skill, difficulty: d, question: fix(g.question), options: g.options.map(fix), correctIndex: g.correctIndex, explanation: fix(g.explanation) };
      if (!passesRules(q) || seenHashes.has(questionHash(q))) failed.push(d);
      else candidates.push(q);
    });
    if (candidates.length) {
      // Blind check: the second model never sees the answer key.
      const solved = await deps.solve(
        skill,
        candidates.map((c) => ({ question: c.question, options: c.options })),
      );
      candidates.forEach((c, i) => {
        const s = solved.answers[i];
        const h = questionHash(c);
        if (s && !s.ambiguous && s.answer === c.correctIndex && !seenHashes.has(h)) {
          seenHashes.add(h);
          stems.push(c.question.slice(0, 120));
          out.push(c);
          onProgress?.();
        } else failed.push(c.difficulty);
      });
    }
    return failed;
  };

  let pending = await attempt(difficulties);
  // Up to 2 retries for the failed slots, then 2 more tries with a new angle.
  for (let round = 0; round < 4 && pending.length > 0; round++) {
    const angle = round >= 2 ? ANGLES[(round + skill.length) % ANGLES.length] : undefined;
    pending = await attempt(pending, angle);
  }
  if (pending.length > 0) throw new Error(`Could not prepare enough reliable questions for ${skill}.`);
  return out;
}

/** Fisher-Yates shuffle with crypto randomness. */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffle a question's options and remap the correct index. */
export function shuffleOptions(q: Question): Question {
  const order = shuffle([0, 1, 2, 3]);
  return { ...q, options: order.map((i) => q.options[i]), correctIndex: order.indexOf(q.correctIndex) };
}

/** 15 slots: about 20% medium, 60% hard, 20% expert, spread across skills. */
export function difficultyPlan(split: number[]): Difficulty[][] {
  const total = split.reduce((a, b) => a + b, 0);
  const nMedium = Math.round(total * 0.2);
  const nExpert = Math.round(total * 0.2);
  const pool: Difficulty[] = [...Array(nMedium).fill('medium'), ...Array(total - nMedium - nExpert).fill('hard'), ...Array(nExpert).fill('expert')];
  // Deal round-robin so each skill gets a similar mix.
  const plan: Difficulty[][] = split.map(() => []);
  let k = 0;
  for (const d of pool) {
    while (plan[k % split.length].length >= split[k % split.length]) k++;
    plan[k % split.length].push(d);
    k++;
  }
  return plan;
}
