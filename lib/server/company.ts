// Company data. Students are only ever exposed through toCompanyCandidateDTO(),
// except name + email for invites the student has ACCEPTED.
import { and, desc, eq, gt, gte, inArray, sql } from 'drizzle-orm';
import { db } from './db';
import { companies, companyRequirements, invites, skillRecords, studentProfiles, users, type RequirementSkill } from './db/schema';
import { env } from './env';
import { toCompanyCandidateDTO, type CompanyCandidateDTO } from '@/lib/companyDto';
import { matchPercent } from '@/lib/scoring';

export const INVITES_PER_DAY = 20;

/** Visible + currently verified students, as DTOs (plus an internal id map for invites). */
export async function visiblePool() {
  const now = new Date();
  const conds = [eq(studentProfiles.visibleToCompanies, true), eq(studentProfiles.verified, true), gt(studentProfiles.verifiedUntil, now)];
  if (!env.showSynthetic) conds.push(eq(studentProfiles.isSynthetic, false));
  const profiles = await db
    .select({
      userId: studentProfiles.userId,
      anonCode: studentProfiles.anonCode,
      gradYear: studentProfiles.gradYear,
      educationLevel: studentProfiles.educationLevel,
      testScorePct: studentProfiles.testScorePct,
      verified: studentProfiles.verified,
      distinction: studentProfiles.distinction,
      verifiedUntil: studentProfiles.verifiedUntil,
      redactedHighlights: studentProfiles.redactedHighlights,
      isSynthetic: studentProfiles.isSynthetic,
    })
    .from(studentProfiles)
    .where(and(...conds));
  const ids = profiles.map((p) => p.userId);
  const skills = ids.length
    ? await db
        .select({ studentId: skillRecords.studentId, skill: skillRecords.skill, scorePct: skillRecords.scorePct, verified: skillRecords.verified, tested: skillRecords.tested, expiresAt: skillRecords.expiresAt })
        .from(skillRecords)
        .where(and(inArray(skillRecords.studentId, ids), eq(skillRecords.tested, true)))
    : [];
  const byStudent = new Map<string, typeof skills>();
  for (const s of skills) byStudent.set(s.studentId, [...(byStudent.get(s.studentId) ?? []), s]);
  const idByCode = new Map<string, string>();
  const dtos: CompanyCandidateDTO[] = profiles.map((p) => {
    idByCode.set(p.anonCode, p.userId);
    return toCompanyCandidateDTO({ ...p, skills: byStudent.get(p.userId) ?? [] }, now);
  });
  return { dtos, idByCode, hasSynthetic: profiles.some((p) => p.isSynthetic) };
}

export async function companyRequirementsList(companyId: string) {
  return db.select().from(companyRequirements).where(eq(companyRequirements.companyId, companyId)).orderBy(desc(companyRequirements.createdAt));
}

/** Everything on the single-page company dashboard. */
export async function getCompanyDashboard(companyId: string, requirementId: string | null) {
  const [company] = await db.select().from(companies).where(eq(companies.userId, companyId));
  const reqs = await companyRequirementsList(companyId);
  const req = requirementId ? reqs.find((r) => r.id === requirementId) ?? null : null;
  const { dtos, idByCode, hasSynthetic } = await visiblePool();

  const myInvites = await db
    .select({ studentId: invites.studentId, requirementId: invites.requirementId, status: invites.status, createdAt: invites.createdAt })
    .from(invites)
    .where(eq(invites.companyId, companyId));

  // Candidates with match info for the selected requirement.
  const candidates = dtos
    .map((c) => {
      const m = req ? matchPercent(req.skills, c.skills) : null;
      const sid = idByCode.get(c.anonCode)!;
      const inv = myInvites.find((i) => i.studentId === sid && (req ? i.requirementId === req.id : true));
      return { ...c, match: m?.pct ?? null, missingMustHave: m?.missingMustHave ?? [], invite: inv?.status ?? null };
    })
    .sort((a, b) => (b.match ?? 0) - (a.match ?? 0) || b.overallScore - a.overallScore);

  // Analytics.
  const verifiedCount = (skill: string) => dtos.filter((c) => c.skills.some((s) => s.skill === skill && s.verified)).length;
  const demandSupply = req ? req.skills.map((s) => ({ skill: s.skill, weight: s.weight, mustHave: s.mustHave, verified: verifiedCount(s.skill) })) : [];
  const skillTotals = new Map<string, number>();
  for (const c of dtos) for (const s of c.skills) if (s.verified) skillTotals.set(s.skill, (skillTotals.get(s.skill) ?? 0) + 1);
  const topSkills = [...skillTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([skill, count]) => ({ skill, count }));
  const bins = [70, 75, 80, 85, 90, 95].map((lo) => ({
    range: lo === 95 ? '95-100' : `${lo}-${lo + 4}`,
    count: dtos.filter((c) => c.overallScore >= lo && (lo === 95 ? c.overallScore <= 100 : c.overallScore < lo + 5)).length,
  }));

  // Accepted invites: the only place contact details appear.
  const accepted = await db
    .select({
      studentId: invites.studentId,
      name: users.name,
      email: users.email,
      requirementId: invites.requirementId,
      respondedAt: invites.respondedAt,
      anonCode: studentProfiles.anonCode,
    })
    .from(invites)
    .innerJoin(users, eq(users.id, invites.studentId))
    .innerJoin(studentProfiles, eq(studentProfiles.userId, invites.studentId))
    .where(and(eq(invites.companyId, companyId), eq(invites.status, 'accepted')))
    .orderBy(desc(invites.respondedAt));

  return {
    company: company ? { name: company.companyName, industry: company.industry } : null,
    requirements: reqs.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    selected: req?.id ?? null,
    kpis: {
      candidates: dtos.length,
      avgScore: dtos.length ? Math.round(dtos.reduce((s, c) => s + c.overallScore, 0) / dtos.length) : 0,
      openRequirements: reqs.filter((r) => r.status === 'open').length,
      invitesAccepted: accepted.length,
      invitesSentToday: myInvites.filter((i) => i.createdAt.getTime() > Date.now() - 86400_000).length,
    },
    analytics: { demandSupply, topSkills, histogram: bins },
    candidates,
    accepted: accepted.map((a) => ({
      anonCode: a.anonCode,
      name: a.name,
      email: a.email,
      role: reqs.find((r) => r.id === a.requirementId)?.roleTitle ?? 'General interest',
      respondedAt: a.respondedAt?.toISOString() ?? null,
    })),
    hasSynthetic: hasSynthetic && env.showSynthetic,
    invitesPerDay: INVITES_PER_DAY,
  };
}

export async function knownSkills() {
  const rows = await db.selectDistinct({ skill: skillRecords.skill }).from(skillRecords).limit(400);
  const fromReqs = await db.select({ skills: companyRequirements.skills }).from(companyRequirements);
  const set = new Set(rows.map((r) => r.skill));
  for (const r of fromReqs) for (const s of r.skills) set.add(s.skill);
  return [...set].sort();
}

export class CompanyError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export interface RequirementInput {
  roleTitle: string;
  experienceLevel: 'fresher' | '0-2y';
  openings: number;
  minOverallScore: number;
  status: 'open' | 'closed';
  skills: RequirementSkill[];
}

export async function saveRequirement(companyId: string, input: RequirementInput, id?: string) {
  // de-duplicate skills
  const skills = [...new Map(input.skills.map((s) => [s.skill, s])).values()];
  if (id) {
    const r = await db
      .update(companyRequirements)
      .set({ ...input, skills })
      .where(and(eq(companyRequirements.id, id), eq(companyRequirements.companyId, companyId)))
      .returning({ id: companyRequirements.id });
    if (!r.length) throw new CompanyError('Requirement not found.', 404);
    return r[0].id;
  }
  const [r] = await db.insert(companyRequirements).values({ companyId, ...input, skills }).returning({ id: companyRequirements.id });
  return r.id;
}

export async function sendInvite(companyId: string, input: { anonCode: string; requirementId: string | null; message: string }) {
  const since = new Date(Date.now() - 86400_000);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(invites)
    .where(and(eq(invites.companyId, companyId), gte(invites.createdAt, since)));
  if (n >= INVITES_PER_DAY) throw new CompanyError(`You can send up to ${INVITES_PER_DAY} invites per day.`, 429);

  if (input.requirementId) {
    const [r] = await db
      .select({ id: companyRequirements.id })
      .from(companyRequirements)
      .where(and(eq(companyRequirements.id, input.requirementId), eq(companyRequirements.companyId, companyId)));
    if (!r) throw new CompanyError('Requirement not found.', 404);
  }
  // The candidate must still be visible and verified right now.
  const { idByCode } = await visiblePool();
  const studentId = idByCode.get(input.anonCode);
  if (!studentId) throw new CompanyError('This candidate is no longer available.', 404);
  try {
    await db.insert(invites).values({ companyId, studentId, requirementId: input.requirementId, message: input.message });
  } catch (e) {
    if (/duplicate key|unique/i.test(String((e as Error).message) + String((e as { cause?: Error }).cause?.message ?? ''))) {
      throw new CompanyError('You have already invited this candidate for this requirement.', 409);
    }
    throw e;
  }
}
