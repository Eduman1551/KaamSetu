// College summary: aggregates ONLY (k >= 5). No names, emails, ids or individual scores.
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { colleges, companyRequirements, skillRecords, studentProfiles, testAttempts, workshops, type WorkshopPlan } from './db/schema';
import { env } from './env';
import { chatJSON } from './groq';
import { lacking, overview, priorityGaps, skillStats, workshopSignature, type SkillStat } from '@/lib/collegeStats';
import { displaySkill } from '@/lib/skillNames';

async function demandTable() {
  const open = await db.select({ skills: companyRequirements.skills }).from(companyRequirements).where(eq(companyRequirements.status, 'open'));
  const counts = new Map<string, number>();
  for (const r of open) for (const s of new Set(r.skills.map((x) => x.skill))) counts.set(s, (counts.get(s) ?? 0) + 1);
  const pct = (skill: string) => (open.length ? Math.round(((counts.get(skill) ?? 0) / open.length) * 100) : 0);
  const top = [...counts.keys()].map((skill) => ({ skill, pct: pct(skill) })).sort((a, b) => b.pct - a.pct).slice(0, 6);
  return { pct, top, openRequirements: open.length };
}

/** Everything the one-page college dashboard shows. */
export async function getCollegeSummary(collegeId: string) {
  const [college] = await db.select().from(colleges).where(eq(colleges.userId, collegeId));
  if (!college) throw new Error('College not found.');
  const conds = [eq(studentProfiles.collegeId, collegeId)];
  if (!env.showSynthetic) conds.push(eq(studentProfiles.isSynthetic, false));
  const profiles = await db
    .select({ id: studentProfiles.userId, verified: studentProfiles.verified, until: studentProfiles.verifiedUntil, score: studentProfiles.testScorePct, synthetic: studentProfiles.isSynthetic })
    .from(studentProfiles)
    .where(and(...conds));
  const ids = profiles.map((p) => p.id);
  const testedIds = new Set(
    ids.length
      ? (
          await db
            .selectDistinct({ id: testAttempts.studentId })
            .from(testAttempts)
            .where(and(inArray(testAttempts.studentId, ids), inArray(testAttempts.status, ['submitted', 'flagged'])))
        ).map((r) => r.id)
      : [],
  );
  const now = new Date();
  const stats = overview(
    profiles.map((p) => ({ tested: testedIds.has(p.id), verified: p.verified && !!p.until && p.until > now, testScorePct: testedIds.has(p.id) ? p.score : null })),
  );
  const skillRows = ids.length
    ? await db
        .select({ skill: skillRecords.skill, scorePct: skillRecords.scorePct })
        .from(skillRecords)
        .where(and(inArray(skillRecords.studentId, ids), eq(skillRecords.tested, true)))
    : [];
  const demand = await demandTable();
  const perSkill = skillStats(
    skillRows.filter((r) => r.scorePct != null).map((r) => ({ skill: r.skill, scorePct: r.scorePct! })),
    demand.pct,
  );
  const gaps = priorityGaps(perSkill);

  // Cached workshop plans that still match the current data.
  const cached = await db.select().from(workshops).where(eq(workshops.collegeId, collegeId));
  const plans = gaps.map((g) => {
    const c = cached.find((w) => w.skill === g.skill && w.signature === workshopSignature(g));
    return c ? c.plan : null;
  });

  return {
    college: { name: college.collegeName, joinCode: college.joinCode },
    stats,
    lacking: lacking(perSkill),
    expected: demand.top,
    openRequirements: demand.openRequirements,
    gaps,
    plans,
    hasSynthetic: env.showSynthetic && profiles.some((p) => p.synthetic),
  };
}

const clip = (n: number) => z.coerce.string().transform((x) => x.trim().slice(0, n));
const PlanSchema = z.object({
  title: clip(110).refine((x) => x.length >= 5),
  topics: z
    .array(z.union([z.string(), z.object({ title: z.string() }).transform((o) => o.title)]))
    .transform((a) => a.map((t) => t.trim().slice(0, 120)).filter(Boolean).slice(0, 3))
    .refine((a) => a.length === 3),
  duration: clip(50).catch('1 day (6 hours)'),
  audience: clip(140).catch('Final-year students'),
});

async function generatePlan(g: SkillStat): Promise<WorkshopPlan> {
  return chatJSON({
    model: env.modelMain,
    schema: PlanSchema,
    maxTokens: 500,
    system: 'You plan practical one-day college workshops for Indian engineering students. Reply with JSON only.',
    user: `Skill gap: ${displaySkill(g.skill)}
Anonymous cohort data: average test score ${g.avgScore}% (tested by ${g.tested} students); ${g.demandPct}% of open company requirements ask for this skill.
Plan ONE hands-on, 1-day workshop that closes this gap.
JSON: {"title":"short title","topics":["exactly 3 concrete hands-on topics"],"duration":"e.g. 1 day (6 hours)","audience":"target group, one short phrase"}`,
  });
}

/**
 * Make sure each priority gap has a plan for the current data (generated the first
 * time the data changes meaningfully, then cached in the DB). Stateless: if two
 * requests race, both upsert the same row, which is harmless.
 */
export async function ensureWorkshops(collegeId: string) {
  const summary = await getCollegeSummary(collegeId);
  for (let i = 0; i < summary.gaps.length; i++) {
    if (summary.plans[i]) continue;
    const gap = summary.gaps[i];
    const plan = await generatePlan(gap); // sequential: Groq free tier
    await db
      .insert(workshops)
      .values({ collegeId, skill: gap.skill, plan, signature: workshopSignature(gap) })
      .onConflictDoUpdate({ target: [workshops.collegeId, workshops.skill], set: { plan, signature: workshopSignature(gap), createdAt: new Date() } });
    summary.plans[i] = plan;
  }
  return summary.plans;
}
