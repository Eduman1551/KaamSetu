// Student data: saving analyses and loading the dashboard. Students only ever
// read their own rows through these functions.
import sharp from 'sharp';
import { and, desc, eq, inArray, notInArray } from 'drizzle-orm';
import { db } from './db';
import {
  analyses,
  analysisShots,
  colleges,
  invites,
  skillRecords,
  studentProfiles,
  testAttempts,
  users,
  type StoredAnalysis,
} from './db/schema';
import type { PipelineOutput } from './pipeline';
import { scrubHighlights } from '@/lib/redact';
import { retakeStatus } from '@/lib/scoring';
import { MIN_CORE_SKILLS } from './testConfig';

/** Save a finished analysis (replacing the previous one). Returns the stored result. */
export async function saveAnalysis(userId: string, out: PipelineOutput): Promise<StoredAnalysis> {
  const [u] = await db
    .select({ name: users.name, email: users.email, collegeName: colleges.collegeName })
    .from(users)
    .leftJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .leftJoin(colleges, eq(colleges.userId, studentProfiles.collegeId))
    .where(eq(users.id, userId));
  const highlights = scrubHighlights(out.highlights, { name: u?.name, email: u?.email, collegeName: u?.collegeName });

  // Compress screenshots to webp before storing.
  const webps = await Promise.all(out.shots.map((s) => (s ? sharp(s).webp({ quality: 70 }).toBuffer() : null)));
  const stored: StoredAnalysis = { ...out.result, coreSkills: out.coreSkills };

  await db.transaction(async (tx) => {
    await tx.delete(analyses).where(eq(analyses.studentId, userId)); // cascades old screenshots
    const [a] = await tx.insert(analyses).values({ studentId: userId, result: stored }).returning({ id: analyses.id });
    const v = a.id.slice(0, 8); // cache-buster so a new analysis never shows an old image
    stored.proofCards = stored.proofCards.map((c, i) => ({ ...c, shotUrl: webps[i] ? `/api/student/shot/${i}?v=${v}` : null }));
    await tx.update(analyses).set({ result: stored }).where(eq(analyses.id, a.id));
    for (let i = 0; i < webps.length; i++) {
      const bytes = webps[i];
      if (bytes) await tx.insert(analysisShots).values({ analysisId: a.id, idx: i, bytes });
    }

    // Skill records: resume skills are in_resume = true; others keep test data but leave the resume.
    if (out.resumeSkills.length) {
      for (const skill of out.resumeSkills) {
        await tx
          .insert(skillRecords)
          .values({ studentId: userId, skill, inResume: true })
          .onConflictDoUpdate({ target: [skillRecords.studentId, skillRecords.skill], set: { inResume: true } });
      }
      await tx
        .update(skillRecords)
        .set({ inResume: false })
        .where(and(eq(skillRecords.studentId, userId), notInArray(skillRecords.skill, out.resumeSkills)));
    }

    await tx
      .update(studentProfiles)
      .set({
        latestOverallScore: out.result.overallScore,
        scoreBreakdown: out.result.subScores,
        redactedHighlights: highlights,
        analysedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(studentProfiles.userId, userId));
  });
  return stored;
}

export async function getShot(userId: string, idx: number) {
  const [row] = await db
    .select({ bytes: analysisShots.bytes })
    .from(analysisShots)
    .innerJoin(analyses, eq(analyses.id, analysisShots.analysisId))
    .where(and(eq(analyses.studentId, userId), eq(analysisShots.idx, idx)));
  return row?.bytes ?? null;
}

export type VerificationState = 'none' | 'verified' | 'distinction' | 'expired';

/** Everything the student dashboard shows (own data only). */
export async function getStudentDashboard(userId: string) {
  const [p] = await db
    .select({
      gradYear: studentProfiles.gradYear,
      educationLevel: studentProfiles.educationLevel,
      visible: studentProfiles.visibleToCompanies,
      anonCode: studentProfiles.anonCode,
      latestOverallScore: studentProfiles.latestOverallScore,
      highlights: studentProfiles.redactedHighlights,
      testScorePct: studentProfiles.testScorePct,
      verified: studentProfiles.verified,
      distinction: studentProfiles.distinction,
      verifiedUntil: studentProfiles.verifiedUntil,
      collegeName: colleges.collegeName,
      joinCode: colleges.joinCode,
    })
    .from(studentProfiles)
    .leftJoin(colleges, eq(colleges.userId, studentProfiles.collegeId))
    .where(eq(studentProfiles.userId, userId));

  const [analysisRow] = await db.select({ result: analyses.result }).from(analyses).where(eq(analyses.studentId, userId));
  const skills = await db
    .select({
      skill: skillRecords.skill,
      inResume: skillRecords.inResume,
      tested: skillRecords.tested,
      verified: skillRecords.verified,
      scorePct: skillRecords.scorePct,
      expiresAt: skillRecords.expiresAt,
    })
    .from(skillRecords)
    .where(eq(skillRecords.studentId, userId));
  const attempts = await db
    .select({
      id: testAttempts.id,
      status: testAttempts.status,
      generatedAt: testAttempts.generatedAt,
      startedAt: testAttempts.startedAt,
      submittedAt: testAttempts.submittedAt,
      correct: testAttempts.correct,
      totalQ: testAttempts.totalQ,
      scorePct: testAttempts.scorePct,
      verified: testAttempts.verified,
      distinction: testAttempts.distinction,
      flagged: testAttempts.flagged,
      skills: testAttempts.skills,
    })
    .from(testAttempts)
    .where(eq(testAttempts.studentId, userId))
    .orderBy(desc(testAttempts.generatedAt));
  const pendingInvites = (
    await db.select({ id: invites.id }).from(invites).where(and(eq(invites.studentId, userId), inArray(invites.status, ['pending'])))
  ).length;

  const now = new Date();
  const verifiedNow = !!p?.verified && !!p.verifiedUntil && p.verifiedUntil > now;
  const verification: VerificationState = verifiedNow ? (p!.distinction ? 'distinction' : 'verified') : p?.verified ? 'expired' : 'none';
  const submitted = attempts.filter((a) => a.submittedAt && (a.status === 'submitted' || a.status === 'flagged')).map((a) => a.submittedAt!);
  const retake = retakeStatus(submitted, now);
  const coreSkills = analysisRow?.result.coreSkills ?? [];

  return {
    profile: p
      ? {
          ...p,
          highlights: p.highlights ?? [],
          verifiedUntil: p.verifiedUntil?.toISOString() ?? null,
        }
      : null,
    analysis: analysisRow?.result ?? null,
    coreSkills,
    canTest: coreSkills.length >= MIN_CORE_SKILLS,
    skills: skills
      .map((s) => ({ ...s, expiresAt: s.expiresAt?.toISOString() ?? null }))
      .sort((a, b) => Number(b.verified) - Number(a.verified) || Number(b.tested) - Number(a.tested) || a.skill.localeCompare(b.skill)),
    attempts: attempts.map((a) => ({
      ...a,
      generatedAt: a.generatedAt.toISOString(),
      startedAt: a.startedAt?.toISOString() ?? null,
      submittedAt: a.submittedAt?.toISOString() ?? null,
    })),
    verification,
    retake: { allowed: retake.allowed, nextAt: retake.nextAt?.toISOString() ?? null, reason: retake.reason ?? null },
    pendingInvites,
  };
}

export type StudentDashboardData = Awaited<ReturnType<typeof getStudentDashboard>>;
