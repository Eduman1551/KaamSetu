import { describe, expect, it } from 'vitest';
import { lacking, overview, priorityGaps, skillStats, workshopSignature, type StudentRow } from '@/lib/collegeStats';

const row = (o: Partial<StudentRow> = {}): StudentRow => ({ tested: true, verified: true, testScorePct: 80, ...o });
const scores = (skill: string, list: number[]) => list.map((scorePct) => ({ skill, scorePct }));

describe('k >= 5 suppression', () => {
  it('hides cohort percentages for fewer than 5 students', () => {
    const o = overview([row(), row(), row(), row()]);
    expect(o.verifiedPct).toBeNull();
    expect(o.testedPct).toBeNull();
    expect(o.avgScore).toBeNull();
    expect(overview([row(), row(), row(), row(), row()]).verifiedPct).toBe(100);
  });

  it('hides the average score when fewer than 5 were tested', () => {
    const rows = [row(), row(), row(), row(), row({ tested: false, testScorePct: null }), row({ tested: false, testScorePct: null })];
    expect(overview(rows).avgScore).toBeNull();
    expect(overview(rows).testedPct).toBe(67);
  });

  it('drops skills tested by fewer than 5 students', () => {
    const s = skillStats([...scores('sql', [50, 55, 60, 65, 70, 75]), ...scores('docker', [20, 20, 20])], (k) => (k === 'sql' ? 80 : 60));
    expect(s.map((x) => x.skill)).toEqual(['sql']);
    expect(s[0]).toMatchObject({ tested: 6, avgScore: 63, demandPct: 80, gapIndex: 29.6 });
  });
});

describe('ranking', () => {
  const stats = skillStats(
    ['a', 'b', 'c', 'd', 'e', 'f', 'g'].flatMap((k, i) => scores(k, [40 + i * 8, 40 + i * 8, 40 + i * 8, 40 + i * 8, 40 + i * 8])),
    (k) => (k === 'g' ? 0 : 50),
  );
  it('lists the 6 lowest averages', () => {
    expect(lacking(stats).map((s) => s.skill)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
  it('picks the 3 highest gap indexes, ignoring zero demand', () => {
    expect(priorityGaps(stats).map((s) => s.skill)).toEqual(['a', 'b', 'c']);
  });
  it('workshop cache key only changes on meaningful moves', () => {
    const base = { skill: 'docker', tested: 10, avgScore: 41, demandPct: 52, gapIndex: 30 };
    expect(workshopSignature(base)).toBe(workshopSignature({ ...base, avgScore: 42, demandPct: 54 }));
    expect(workshopSignature(base)).not.toBe(workshopSignature({ ...base, avgScore: 50 }));
  });
});
