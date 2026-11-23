// College data: aggregates ONLY. No names, emails, ids or individual scores leave this file.
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { colleges, companyRequirements, skillRecords, studentProfiles, testAttempts, workshops, type WorkshopPlan } from './db/schema';
import { env } from './env';
import { chatJSON } from './groq';
import { distribution, monthlyTrend, overview, skillGaps, type GapRow, type StudentRow } from '@/lib/collegeStats';
import { displaySkill } from '@/lib/skillNames';

export class CollegeError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

async function linkedStudents(collegeId: string, gradYear: number | null) {
  const conds = [eq(studentProfiles.collegeId, collegeId)];
  if (gradYear) conds.push(eq(studentProfiles.gradYear, gradYear));
  if (!env.showSynthetic) conds.push(eq(studentProfiles.isSynthetic, false));
  const profiles = await db
    .select({
      id: studentProfiles.userId,
      gradYear: studentProfiles.gradYear,
      educationLevel: studentProfiles.educationLevel,
      analysedAt: studentProfiles.analysedAt,
      verified: studentProfiles.verified,
      verifiedUntil: studentProfiles.verifiedUntil,
      visible: studentProfiles.visibleToCompanies,
      testScorePct: studentProfiles.testScorePct,
      isSynthetic: studentProfiles.isSynthetic,
    })
    .from(studentProfiles)
    .where(and(...conds));
  const ids = profiles.map((p) => p.id);
  const attempts = ids.length
    ? await db
        .select({ studentId: testAttempts.studentId, at: testAttempts.submittedAt, verified: testAttempts.verified })
        .from(testAttempts)
        .where(and(inArray(testAttempts.studentId, ids), inArray(testAttempts.status, ['submitted', 'flagged'])))
    : [];
  const now = new Date();
  const rows: StudentRow[] = profiles.map((p) => {
    const mine = attempts.filter((a) => a.studentId === p.id && a.at);
    return {
      gradYear: p.gradYear,
      educationLevel: p.educationLevel,
      analysed: !!p.analysedAt,
      tested: mine.length > 0,
      verified: p.verified && !!p.verifiedUntil && p.verifiedUntil > now,
      visible: p.visible,
      testScorePct: mine.length ? p.testScorePct : null,
      attempts: mine.map((a) => ({ at: a.at!, verified: a.verified })),
    };
  });
  return { ids, rows, hasSynthetic: profiles.some((p) => p.isSynthetic) };
}

async function demandFn() {
  const open = await db.select({ skills: companyRequirements.skills }).from(companyRequirements).where(eq(companyRequirements.status, 'open'));
  const counts = new Map<string, number>();
  for (const r of open) for (const s of new Set(r.skills.map((x) => x.skill))) counts.set(s, (counts.get(s) ?? 0) + 1);
  return (skill: string) => (open.length ? Math.round(((counts.get(skill) ?? 0) / open.length) * 100) : 0);
}

export async function getCollegeDashboard(collegeId: string, gradYear: number | null) {
  const [college] = await db.select().from(colleges).where(eq(colleges.userId, collegeId));
  if (!college) throw new CollegeError('College not found.', 404);
  const { ids, rows, hasSynthetic } = await linkedStudents(collegeId, gradYear);
  const skillRows = ids.length
    ? await db
        .select({ skill: skillRecords.skill, scorePct: skillRecords.scorePct, verified: skillRecords.verified })
        .from(skillRecords)
        .where(and(inArray(skillRecords.studentId, ids), eq(skillRecords.tested, true)))
    : [];
  const gaps = skillGaps(
    skillRows.filter((s) => s.scorePct != null).map((s) => ({ skill: s.skill, scorePct: s.scorePct!, verified: s.verified })),
    await demandFn(),
  );
  const cached = await db.select().from(workshops).where(eq(workshops.collegeId, collegeId));
  const years = await db.selectDistinct({ y: studentProfiles.gradYear }).from(studentProfiles).where(eq(studentProfiles.collegeId, collegeId));
  return {
    college: { name: college.collegeName, city: college.city, state: college.state, joinCode: college.joinCode },
    gradYear,
    years: years.map((y) => y.y).sort(),
    overview: overview(rows),
    trend: monthlyTrend(rows),
    gaps,
    distribution: distribution(rows),
    workshops: Object.fromEntries(cached.map((w) => [w.skill, w.plan])) as Record<string, WorkshopPlan>,
    hasSynthetic: hasSynthetic && env.showSynthetic,
  };
}

// Tolerant schema: trim long answers instead of rejecting them.
const clip = (n: number) => z.coerce.string().transform((x) => x.trim().slice(0, n));
const PlanSchema = z.object({
  title: clip(120).refine((x) => x.length >= 5),
  topics: z
    .array(z.union([z.string(), z.object({ title: z.string() }).transform((o) => o.title)]))
    .transform((a) => a.map((t) => t.trim().slice(0, 140)).filter(Boolean).slice(0, 7))
    .refine((a) => a.length >= 3),
  duration: clip(60).catch('1 day (6 hours)'),
  audience: clip(200).catch('Final-year students and recent graduates'),
});

/** Generate (or return cached) a 1-day workshop plan for a priority gap. */
export async function workshopFor(collegeId: string, skill: string, regenerate = false) {
  const data = await getCollegeDashboard(collegeId, null);
  const gap = data.gaps.find((g) => g.skill === skill);
  if (!gap || !gap.priority) throw new CollegeError('Workshops are suggested for priority gaps only.', 400);
  if (!regenerate && data.workshops[skill]) return data.workshops[skill];
  const plan = await chatJSON({
    model: env.modelMain,
    schema: PlanSchema,
    maxTokens: 700,
    system: 'You plan practical one-day college workshops for Indian engineering students. Reply with JSON only.',
    user: `Skill gap: ${displaySkill(skill)}
Cohort data (anonymous): average test score ${gap.avgScore}%, ${gap.verifiedPct}% verified, company demand ${gap.demandPct}% of open requirements.
Plan ONE hands-on, 1-day workshop that targets this gap for final-year students and freshers.
JSON: {"title":"","topics":["5-7 concrete hands-on topics in teaching order"],"duration":"e.g. 1 day (6 hours)","audience":"who should attend, based on the data"}`,
  });
  await db
    .insert(workshops)
    .values({ collegeId, skill, plan })
    .onConflictDoUpdate({ target: [workshops.collegeId, workshops.skill], set: { plan, createdAt: new Date() } });
  return plan;
}

/** Aggregate CSV report (already suppressed). */
export async function reportCsv(collegeId: string, gradYear: number | null) {
  const d = await getCollegeDashboard(collegeId, gradYear);
  const cell = (v: unknown) => {
    const s = v == null ? 'Not enough data' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    ['KaamSetu aggregate report', d.college.name, gradYear ? `Graduation year ${gradYear}` : 'All years', new Date().toISOString().slice(0, 10)].map(cell).join(','),
    '',
    'Metric,Value',
    `Students linked,${d.overview.linked}`,
    `% analysed a resume,${cell(d.overview.analysedPct)}`,
    `% took the test,${cell(d.overview.testedPct)}`,
    `% verified,${cell(d.overview.verifiedPct)}`,
    `Average test score %,${cell(d.overview.avgScore)}`,
    '',
    'Skill,Students tested,Average score %,% verified,Company demand %,Gap index,Priority gap',
    ...d.gaps.map((g: GapRow) => [displaySkill(g.skill), g.tested, g.avgScore, g.verifiedPct, g.demandPct, g.gapIndex, g.priority ? 'yes' : 'no'].map(cell).join(',')),
    '',
    'Statistics based on fewer than 5 students are suppressed to protect privacy.',
  ];
  return lines.join('\n');
}
