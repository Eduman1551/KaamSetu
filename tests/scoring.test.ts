import { describe, expect, it } from 'vitest';
import { gapIndex, matchPercent, questionSplit, retakeStatus, scoreAttempt, skillVerified, suppress } from '@/lib/scoring';
import { selectCoreSkills } from '@/lib/coreSkills';

const DAY = 86400000;
const qs = (perSkill: Record<string, boolean[]>) =>
  Object.entries(perSkill).flatMap(([skill, answers]) => answers.map((isCorrect) => ({ skill, isCorrect })));

describe('question split', () => {
  it('always totals 15', () => {
    expect(questionSplit(5)).toEqual([3, 3, 3, 3, 3]);
    expect(questionSplit(4)).toEqual([4, 4, 4, 3]);
    expect(questionSplit(3)).toEqual([5, 5, 5]);
    expect(questionSplit(7)).toEqual([3, 3, 3, 3, 3]);
    expect(questionSplit(2)).toEqual([]);
  });
});

describe('scoring and pass rules', () => {
  it('11/15 passes, 10/15 fails, 13/15 is distinction', () => {
    const mk = (correct: number) => Array.from({ length: 15 }, (_, i) => ({ skill: `s${i % 5}`, isCorrect: i < correct }));
    expect(scoreAttempt(mk(10), 0).verified).toBe(false);
    expect(scoreAttempt(mk(11), 0).verified).toBe(true);
    expect(scoreAttempt(mk(11), 0).scorePct).toBe(73);
    expect(scoreAttempt(mk(12), 0).distinction).toBe(false);
    expect(scoreAttempt(mk(13), 0).distinction).toBe(true);
  });

  it('a skill is verified with 2 of 3, 3 of 4, 4 of 5 correct', () => {
    expect(skillVerified(2, 3)).toBe(true);
    expect(skillVerified(1, 3)).toBe(false);
    expect(skillVerified(3, 4)).toBe(true);
    expect(skillVerified(2, 4)).toBe(false);
    expect(skillVerified(4, 5)).toBe(true);
    expect(skillVerified(3, 5)).toBe(false);
  });

  it('per-skill badges are independent of the overall result', () => {
    const r = scoreAttempt(qs({ sql: [true, true, true], docker: [false, false, true], react: [true, true, false], git: [true, false, false], css: [true, true, false] }), 0);
    expect(r.verified).toBe(false); // 9/15
    expect(r.skills.find((s) => s.skill === 'sql')!.verified).toBe(true);
    expect(r.skills.find((s) => s.skill === 'docker')!.verified).toBe(false);
  });

  it('6+ tab switches flag the attempt and grant nothing', () => {
    const all = Array.from({ length: 15 }, (_, i) => ({ skill: `s${i % 5}`, isCorrect: true }));
    const r = scoreAttempt(all, 6);
    expect(r.flagged).toBe(true);
    expect(r.verified).toBe(false);
    expect(r.distinction).toBe(false);
    expect(r.skills.every((s) => !s.verified)).toBe(true);
    expect(scoreAttempt(all, 5).verified).toBe(true);
  });
});

describe('retake cooldown', () => {
  const now = new Date('2026-11-23T12:00:00Z');
  it('allows the first attempt', () => expect(retakeStatus([], now).allowed).toBe(true));
  it('enforces a 3-day cooldown', () => {
    const r = retakeStatus([new Date(now.getTime() - 2 * DAY)], now);
    expect(r.allowed).toBe(false);
    expect(r.nextAt!.getTime()).toBe(now.getTime() + DAY);
    expect(retakeStatus([new Date(now.getTime() - 3 * DAY - 1000)], now).allowed).toBe(true);
  });
  it('allows at most 3 attempts per rolling 30 days', () => {
    const r = retakeStatus([4, 10, 20].map((d) => new Date(now.getTime() - d * DAY)), now);
    expect(r.allowed).toBe(false);
    expect(r.nextAt!.getTime()).toBe(now.getTime() + 10 * DAY); // oldest of the 3 drops out
    expect(retakeStatus([4, 10, 31].map((d) => new Date(now.getTime() - d * DAY)), now).allowed).toBe(true);
  });
});

describe('match % formula', () => {
  const req = [
    { skill: 'sql', weight: 5, mustHave: true },
    { skill: 'python', weight: 3, mustHave: false },
    { skill: 'docker', weight: 2, mustHave: false },
  ];
  it('weights verified skill scores; unverified counts as 0', () => {
    const r = matchPercent(req, [
      { skill: 'sql', scorePct: 100, verified: true },
      { skill: 'python', scorePct: 67, verified: true },
      { skill: 'docker', scorePct: 33, verified: false },
    ]);
    // (5*1 + 3*0.67 + 2*0) / 10 = 70.1
    expect(r.pct).toBe(70);
    expect(r.missingMustHave).toEqual([]);
  });
  it('reports missing must-have skills', () => {
    const r = matchPercent(req, [{ skill: 'python', scorePct: 100, verified: true }]);
    expect(r.pct).toBe(30);
    expect(r.missingMustHave).toEqual(['sql']);
  });
});

describe('college metrics', () => {
  it('gap index = demand% x (100 - avg score%) / 100', () => {
    expect(gapIndex(60, 40)).toBe(36);
    expect(gapIndex(100, 100)).toBe(0);
    expect(gapIndex(25, 50)).toBe(12.5);
  });
  it('suppresses statistics with fewer than 5 students', () => {
    expect(suppress(4, 72)).toBeNull();
    expect(suppress(5, 72)).toBe(72);
  });
});

describe('core skill selection', () => {
  it('takes testable resume skills in demand, ordered by demand then resume order, max 5', () => {
    const demand = [
      { key: 'excel', count: 12, has: true },
      { key: 'communication', count: 9, has: true },
      { key: 'sql', count: 12, has: false },
      { key: 'java', count: 2, has: true },
      { key: 'python', count: 5, has: true },
      { key: 'javascript', count: 2, has: true },
      { key: 'html', count: 1, has: true },
      { key: 'css', count: 1, has: true },
    ];
    expect(selectCoreSkills(demand, ['python', 'java', 'javascript', 'excel', 'html', 'css'])).toEqual(['excel', 'python', 'java', 'javascript', 'html']);
  });
});
