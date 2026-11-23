// Question generation + blind verification flow, with mocked Groq calls.
import { describe, expect, it, vi } from 'vitest';
import {
  difficultyPlan,
  makeVerifiedQuestions,
  passesRules,
  questionHash,
  shuffleOptions,
  type Deps,
  type GenRequest,
} from '@/lib/server/questionFactory';

let n = 0;
const q = (correctIndex = 1, extra: Partial<{ question: string; options: string[] }> = {}) => ({
  question: extra.question ?? `What does this snippet print in scenario ${++n}? console.log([1,2,3].map(x => x * ${n}))`,
  options: extra.options ?? [`[${n}]`, `[${n},${2 * n},${3 * n}]`, 'undefined', `Error ${n}`],
  correctIndex,
  explanation: 'map returns a new array with each element transformed.',
  difficulty: 'hard' as const,
});

/** Solver that answers with the key, except for questions listed as "wrong". */
const honestSolver = (wrongFor: Set<string> = new Set()): Deps['solve'] =>
  vi.fn(async (_skill, qs) => ({
    answers: qs.map((x: { question: string }) => ({ answer: wrongFor.has(x.question) ? 0 : 1, ambiguous: false })),
  }));

describe('makeVerifiedQuestions', () => {
  it('keeps questions the blind solver agrees with', async () => {
    const deps: Deps = {
      generate: vi.fn(async (r: GenRequest) => ({ questions: r.difficulties.map(() => q(1)) })),
      solve: honestSolver(),
    };
    const out = await makeVerifiedQuestions('javascript', ['medium', 'hard', 'expert'], new Set(), deps);
    expect(out).toHaveLength(3);
    expect(out.map((x) => x.difficulty)).toEqual(['medium', 'hard', 'expert']);
    expect(deps.generate).toHaveBeenCalledTimes(1);
  });

  it('regenerates a question when the solver disagrees with the key', async () => {
    const bad = q(1);
    const calls: GenRequest[] = [];
    const deps: Deps = {
      generate: vi.fn(async (r: GenRequest) => {
        calls.push(r);
        return { questions: calls.length === 1 ? [q(1), bad, q(1)] : r.difficulties.map(() => q(1)) };
      }),
      solve: honestSolver(new Set([bad.question])),
    };
    const out = await makeVerifiedQuestions('sql', ['hard', 'hard', 'hard'], new Set(), deps);
    expect(out).toHaveLength(3);
    expect(out.find((x) => x.question === bad.question)).toBeUndefined();
    expect(calls).toHaveLength(2);
    expect(calls[1].difficulties).toEqual(['hard']); // only the failed slot is regenerated
  });

  it('drops ambiguous questions', async () => {
    let first = true;
    const deps: Deps = {
      generate: vi.fn(async (r: GenRequest) => ({ questions: r.difficulties.map(() => q(1)) })),
      solve: vi.fn(async (_s, qs) => {
        const res = { answers: qs.map(() => ({ answer: 1, ambiguous: first })) };
        first = false;
        return res;
      }),
    };
    const out = await makeVerifiedQuestions('python', ['hard', 'hard'], new Set(), deps);
    expect(out).toHaveLength(2);
    expect(deps.generate).toHaveBeenCalledTimes(2);
  });

  it('never reuses a question hash the student has already seen', async () => {
    const seenQ = q(1);
    const seen = new Set([questionHash(seenQ)]);
    let call = 0;
    const deps: Deps = {
      generate: vi.fn(async (r: GenRequest) => ({ questions: call++ === 0 ? [seenQ] : r.difficulties.map(() => q(1)) })),
      solve: honestSolver(),
    };
    const out = await makeVerifiedQuestions('react', ['hard'], seen, deps);
    expect(out).toHaveLength(1);
    expect(questionHash(out[0])).not.toBe(questionHash(seenQ));
  });

  it('switches angle after 2 failed retries and gives up after that', async () => {
    const reqs: GenRequest[] = [];
    const deps: Deps = {
      generate: vi.fn(async (r: GenRequest) => {
        reqs.push(r);
        return { questions: r.difficulties.map(() => q(1)) };
      }),
      solve: vi.fn(async (_s, qs) => ({ answers: qs.map(() => ({ answer: 3, ambiguous: false })) })), // always disagrees
    };
    await expect(makeVerifiedQuestions('docker', ['expert'], new Set(), deps)).rejects.toThrow(/reliable questions/);
    expect(reqs).toHaveLength(5); // first try + 2 retries + 2 new angles
    expect(reqs[1].angle).toBeUndefined();
    expect(reqs[3].angle).toBeTruthy();
  });
});

describe('question rules', () => {
  it('rejects "all of the above" and duplicate options', () => {
    expect(passesRules({ question: 'Which approach is safest when two writers update the same row concurrently?', options: ['a', 'b', 'c', 'All of the above'] })).toBe(false);
    expect(passesRules({ question: 'Which approach is safest when two writers update the same row concurrently?', options: ['a', 'a', 'c', 'd'] })).toBe(false);
    expect(passesRules({ question: 'Which approach is safest when two writers update the same row concurrently?', options: ['a', 'b', 'c', 'd'] })).toBe(true);
  });

  it('shuffling options keeps the correct answer', () => {
    const base = { ...q(2), skill: 'x' };
    for (let i = 0; i < 20; i++) {
      const s = shuffleOptions(base);
      expect(s.options[s.correctIndex]).toBe(base.options[2]);
      expect([...s.options].sort()).toEqual([...base.options].sort());
    }
  });

  it('difficulty mix is ~20/60/20 and fills every slot', () => {
    for (const split of [[3, 3, 3, 3, 3], [4, 4, 4, 3], [5, 5, 5]]) {
      const plan = difficultyPlan(split);
      expect(plan.map((p) => p.length)).toEqual(split);
      const flat = plan.flat();
      expect(flat.filter((d) => d === 'medium')).toHaveLength(3);
      expect(flat.filter((d) => d === 'hard')).toHaveLength(9);
      expect(flat.filter((d) => d === 'expert')).toHaveLength(3);
    }
  });
});
