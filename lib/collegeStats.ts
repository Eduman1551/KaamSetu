// College aggregates (pure, unit-tested). Every statistic is suppressed unless at
// least K_MIN (5) students contribute, so no single student can be identified.
import { gapIndex, K_MIN } from './scoring';

export interface StudentRow {
  gradYear: number;
  educationLevel: string;
  analysed: boolean;
  tested: boolean;
  verified: boolean; // currently verified
  visible: boolean;
  testScorePct: number | null;
  /** Submitted attempts: when, and whether it verified the student. */
  attempts: { at: Date; verified: boolean }[];
}

export interface SkillRow {
  skill: string;
  scorePct: number;
  verified: boolean;
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
/** Counts 1-4 are shown as "<5"; 0 and >=5 are shown as-is. */
export const safeCount = (n: number): number | '<5' => (n > 0 && n < K_MIN ? '<5' : n);

export function overview(rows: StudentRow[]) {
  const n = rows.length;
  const tested = rows.filter((r) => r.tested);
  const enough = n >= K_MIN;
  return {
    linked: n,
    enough,
    analysedPct: enough ? pct(rows.filter((r) => r.analysed).length, n) : null,
    testedPct: enough ? pct(tested.length, n) : null,
    verifiedPct: enough ? pct(rows.filter((r) => r.verified).length, n) : null,
    avgScore: tested.length >= K_MIN ? Math.round(tested.reduce((s, r) => s + (r.testScorePct ?? 0), 0) / tested.length) : null,
  };
}

/** % of the cohort verified (and tested) at the end of each of the last `months` months. */
export function monthlyTrend(rows: StudentRow[], now = new Date(), months = 6) {
  const out: { month: string; verifiedPct: number | null; testedPct: number | null }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const label = end.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    const yearAgo = new Date(end);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const testedBy = rows.filter((r) => r.attempts.some((a) => a.at <= end)).length;
    const verifiedBy = rows.filter((r) => r.attempts.some((a) => a.verified && a.at <= end && a.at > yearAgo)).length;
    const enough = rows.length >= K_MIN;
    out.push({ month: label, verifiedPct: enough ? pct(verifiedBy, rows.length) : null, testedPct: enough ? pct(testedBy, rows.length) : null });
  }
  return out;
}

export interface GapRow {
  skill: string;
  tested: number | '<5';
  avgScore: number | null;
  verifiedPct: number | null;
  demandPct: number;
  gapIndex: number | null;
  priority: boolean;
}

/**
 * Top 12 skills by number of students tested. Columns are suppressed below K.
 * Sorted by gap index (suppressed rows last); top 5 = "Priority gaps".
 */
export function skillGaps(skillRows: SkillRow[], demandPct: (skill: string) => number): GapRow[] {
  const by = new Map<string, SkillRow[]>();
  for (const r of skillRows) by.set(r.skill, [...(by.get(r.skill) ?? []), r]);
  const rows: GapRow[] = [...by.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 12)
    .map(([skill, list]) => {
      const enough = list.length >= K_MIN;
      const avg = enough ? Math.round(list.reduce((s, r) => s + r.scorePct, 0) / list.length) : null;
      const demand = demandPct(skill);
      return {
        skill,
        tested: safeCount(list.length),
        avgScore: avg,
        verifiedPct: enough ? pct(list.filter((r) => r.verified).length, list.length) : null,
        demandPct: demand,
        gapIndex: avg == null ? null : gapIndex(demand, avg),
        priority: false,
      };
    })
    .sort((a, b) => (b.gapIndex ?? -1) - (a.gapIndex ?? -1));
  rows.filter((r) => r.gapIndex != null && r.gapIndex > 0).slice(0, 5).forEach((r) => (r.priority = true));
  return rows;
}

export function distribution(rows: StudentRow[]) {
  const group = (key: (r: StudentRow) => string) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, n]) => ({ label, count: safeCount(n) }));
  };
  return {
    byYear: group((r) => String(r.gradYear)),
    byEducation: group((r) => r.educationLevel),
    funnel: [
      { label: 'Linked', count: safeCount(rows.length) },
      { label: 'Analysed a resume', count: safeCount(rows.filter((r) => r.analysed).length) },
      { label: 'Took the test', count: safeCount(rows.filter((r) => r.tested).length) },
      { label: 'Verified', count: safeCount(rows.filter((r) => r.verified).length) },
      { label: 'Visible to companies', count: safeCount(rows.filter((r) => r.visible).length) },
    ],
  };
}
