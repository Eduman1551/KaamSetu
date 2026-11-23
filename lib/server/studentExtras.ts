// Student invites, "what companies want", settings and account deletion.
import bcrypt from 'bcryptjs';
import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from './db';
import { colleges, companies, companyRequirements, invites, skillRecords, studentProfiles, users } from './db/schema';
import { toCompanyCandidateDTO } from '@/lib/companyDto';

export class StudentError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export async function getInvites(studentId: string) {
  const rows = await db
    .select({
      id: invites.id,
      company: companies.companyName,
      industry: companies.industry,
      role: companyRequirements.roleTitle,
      message: invites.message,
      status: invites.status,
      createdAt: invites.createdAt,
      respondedAt: invites.respondedAt,
    })
    .from(invites)
    .innerJoin(companies, eq(companies.userId, invites.companyId))
    .leftJoin(companyRequirements, eq(companyRequirements.id, invites.requirementId))
    .where(eq(invites.studentId, studentId))
    .orderBy(desc(invites.createdAt));
  return rows.map((r) => ({ ...r, role: r.role ?? 'General interest', createdAt: r.createdAt.toISOString(), respondedAt: r.respondedAt?.toISOString() ?? null }));
}

/** Accepting reveals the student's name + email to that company only. */
export async function respondInvite(studentId: string, inviteId: string, accept: boolean) {
  const r = await db
    .update(invites)
    .set({ status: accept ? 'accepted' : 'declined', respondedAt: new Date() })
    .where(and(eq(invites.id, inviteId), eq(invites.studentId, studentId), eq(invites.status, 'pending')))
    .returning({ id: invites.id });
  if (!r.length) throw new StudentError('This invite was not found or was already answered.', 404);
}

export const DEMAND_MIN_REQUIREMENTS = 3;

/** Top skills across all companies' open requirements vs the student's verified skills. No company names. */
export async function getDemand(studentId: string) {
  const open = await db.select({ skills: companyRequirements.skills }).from(companyRequirements).where(eq(companyRequirements.status, 'open'));
  if (open.length < DEMAND_MIN_REQUIREMENTS) return { enough: false as const, openRequirements: open.length, skills: [] };
  const counts = new Map<string, number>();
  for (const r of open) for (const s of new Set(r.skills.map((x) => x.skill))) counts.set(s, (counts.get(s) ?? 0) + 1);
  const mine = await db
    .select({ skill: skillRecords.skill, verified: skillRecords.verified, expiresAt: skillRecords.expiresAt, scorePct: skillRecords.scorePct, inResume: skillRecords.inResume })
    .from(skillRecords)
    .where(eq(skillRecords.studentId, studentId));
  const now = new Date();
  const skills = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([skill, n]) => {
      const m = mine.find((x) => x.skill === skill);
      const verified = !!m?.verified && (!m.expiresAt || m.expiresAt > now);
      return { skill, pct: Math.round((n / open.length) * 100), verified, onResume: !!m?.inResume };
    });
  return { enough: true as const, openRequirements: open.length, skills };
}

/** Exactly what a company would see for this student (same DTO mapper). */
export async function getCompanyPreview(studentId: string) {
  const [p] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, studentId));
  if (!p) return null;
  const sk = await db.select().from(skillRecords).where(and(eq(skillRecords.studentId, studentId), eq(skillRecords.tested, true)));
  return toCompanyCandidateDTO({ ...p, skills: sk });
}

export async function setVisibility(studentId: string, visible: boolean) {
  if (visible) {
    const [p] = await db
      .select({ id: studentProfiles.userId })
      .from(studentProfiles)
      .where(and(eq(studentProfiles.userId, studentId), eq(studentProfiles.verified, true), gt(studentProfiles.verifiedUntil, new Date())));
    if (!p) throw new StudentError('Visibility unlocks once you are verified.', 409);
  }
  await db.update(studentProfiles).set({ visibleToCompanies: visible, updatedAt: new Date() }).where(eq(studentProfiles.userId, studentId));
}

export async function joinCollege(studentId: string, joinCode: string) {
  if (!joinCode) {
    await db.update(studentProfiles).set({ collegeId: null }).where(eq(studentProfiles.userId, studentId));
    return { collegeName: null };
  }
  const [c] = await db.select({ id: colleges.userId, name: colleges.collegeName }).from(colleges).where(eq(colleges.joinCode, joinCode));
  if (!c) throw new StudentError('That join code was not found. Check it with your placement cell.', 404);
  await db.update(studentProfiles).set({ collegeId: c.id }).where(eq(studentProfiles.userId, studentId));
  return { collegeName: c.name };
}

/** Any role: change password after checking the current one. */
export async function changePassword(userId: string, current: string, next: string) {
  const [u] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId));
  if (!u || !u.hash.startsWith('$2') || !(await bcrypt.compare(current, u.hash))) throw new StudentError('Your current password is incorrect.', 400);
  if (current === next) throw new StudentError('Choose a new password that is different from the current one.', 400);
  await db.update(users).set({ passwordHash: await bcrypt.hash(next, 12) }).where(eq(users.id, userId));
}

/** Right to erasure: deletes the user and every row that belongs to them (cascades). */
export async function deleteStudentAccount(userId: string, password: string) {
  const [u] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId));
  if (!u || !u.hash.startsWith('$2') || !(await bcrypt.compare(password, u.hash))) throw new StudentError('Password is incorrect.', 400);
  await db.delete(users).where(eq(users.id, userId));
}
