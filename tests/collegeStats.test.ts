import { describe, expect, it } from 'vitest';
import { distribution, monthlyTrend, overview, safeCount, skillGaps, type StudentRow } from '@/lib/collegeStats';

const row = (o: Partial<StudentRow> = {}): StudentRow => ({
  gradYear: 2026,
  educationLevel: 'BCA',
  analysed: true,
  tested: true,
  verified: true,
  visible: false,
  testScorePct: 80,
  attempts: [{ at: new Date('2026-10-01'), verified: true }],
  ...o,
});

describe('k >= 5 suppression', () => {
  it('hides cohort percentages for fewer than 5 students', () => {
    const o = overview([row(), row(), row(), row()]);
    expect(o.enough).toBe(false);
    expect(o.verifiedPct).toBeNull();
    expect(o.avgScore).toBeNull();
    expect(overview([row(), row(), row(), row(), row()]).verifiedPct).toBe(100);
  });

  it('hides average score when fewer than 5 were tested', () => {
    const rows = [row(), row(), row(), row(), row({ tested: false, testScorePct: null }), row({ tested: false, testScorePct: null })];
    expect(overview(rows).avgScore).toBeNull();
  });

  it('suppresses per-skill statistics below 5 tested students', () => {
    const skills = [
      ...Array.from({ length: 6 }, (_, i) => ({ skill: 'sql', scorePct: 50 + i * 5, verified: i > 2 })),
      ...Array.from({ length: 3 }, () => ({ skill: 'docker', scorePct: 20, verified: false })),
    ];
    const g = skillGaps(skills, (s) => (s === 'sql' ? 80 : 60));
    const sql = g.find((r) => r.skill === 'sql')!;
    const docker = g.find((r) => r.skill === 'docker')!;
    expect(sql.avgScore).toBe(63);
    expect(sql.gapIndex).toBe(29.6);
    expect(sql.priority).toBe(true);
    expect(docker.tested).toBe('<5');
    expect(docker.avgScore).toBeNull();
    expect(docker.verifiedPct).toBeNull();
    expect(docker.gapIndex).toBeNull();
    expect(docker.priority).toBe(false);
  });

  it('shows small counts as "<5" (but 0 stays 0)', () => {
    expect(safeCount(0)).toBe(0);
    expect(safeCount(3)).toBe('<5');
    expect(safeCount(5)).toBe(5);
    const d = distribution([row({ gradYear: 2025 }), ...Array.from({ length: 5 }, () => row())]);
    expect(d.byYear).toEqual([
      { label: '2025', count: '<5' },
      { label: '2026', count: 5 },
    ]);
  });

  it('suppresses the monthly trend for tiny cohorts', () => {
    expect(monthlyTrend([row()], new Date('2026-11-23')).every((m) => m.verifiedPct === null)).toBe(true);
    const t = monthlyTrend(Array.from({ length: 5 }, () => row()), new Date('2026-11-23'));
    expect(t.map((m) => m.verifiedPct)).toEqual([0, 0, 0, 0, 100, 100]);
  });

  it('ranks priority gaps by gap index and marks at most 5', () => {
    const skills = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].flatMap((s, i) => Array.from({ length: 5 }, () => ({ skill: s, scorePct: 40 + i * 5, verified: false })));
    const g = skillGaps(skills, () => 50);
    expect(g.filter((r) => r.priority)).toHaveLength(5);
    expect(g[0].skill).toBe('a');
  });
});
