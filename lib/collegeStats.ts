// College aggregates (pure, unit-tested). A statistic is shown only when at least
// K_MIN (5) linked students contribute, so no single student can be identified.
import { gapIndex, K_MIN } from './scoring';

export interface StudentRow {
  tested: boolean;
  verified: boolean; // currently verified
  testScorePct: number | null;
}

export interface SkillRow {
  skill: string;
  scorePct: number;
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

export function overview(rows: StudentRow[]) {
  const n = rows.length;
  const tested = rows.filter((r) => r.tested);
  const enough = n >= K_MIN;
  return {
    linked: n,
    verifiedPct: enough ? pct(rows.filter((r) => r.verified).length, n) : null,
    testedPct: enough ? pct(tested.length, n) : null,
    avgScore: tested.length >= K_MIN ? Math.round(tested.reduce((s, r) => s + (r.testScorePct ?? 0), 0) / tested.length) : null,
  };
}

export interface SkillStat {
  skill: string;
  tested: number;
  avgScore: number;
  demandPct: number;
  gapIndex: number;
}

/** Per-skill stats for skills tested by at least K_MIN linked students (others are dropped). */
export function skillStats(rows: SkillRow[], demandPct: (skill: string) => number): SkillStat[] {
  const by = new Map<string, number[]>();
  for (const r of rows) by.set(r.skill, [...(by.get(r.skill) ?? []), r.scorePct]);
  return [...by.entries()]
    .filter(([, scores]) => scores.length >= K_MIN)
    .map(([skill, scores]) => {
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      const demand = demandPct(skill);
      return { skill, tested: scores.length, avgScore: avg, demandPct: demand, gapIndex: gapIndex(demand, avg) };
    });
}

/** The 6 weakest skills (lowest average score). */
export const lacking = (stats: SkillStat[], n = 6) => [...stats].sort((a, b) => a.avgScore - b.avgScore || b.tested - a.tested).slice(0, n);

/** The 3 priority gaps (highest gap index, must be > 0). */
export const priorityGaps = (stats: SkillStat[], n = 3) =>
  [...stats].filter((s) => s.gapIndex > 0).sort((a, b) => b.gapIndex - a.gapIndex).slice(0, n);

/** Cache key for a workshop plan: changes only when the data moves meaningfully. */
export const workshopSignature = (s: SkillStat) => `${s.skill}|avg${Math.round(s.avgScore / 5) * 5}|dem${Math.round(s.demandPct / 10) * 10}`;
