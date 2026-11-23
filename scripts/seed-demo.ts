// pnpm db:seed:demo — exactly 3 demo accounts (idempotent).
//   Student  student@demo.com   Aarav Sharma, verified 80%, visible to companies
//   Company  company@demo.com   TechNova Pvt Ltd, 1 open requirement
//   College  college@demo.com   Demo Institute of Technology, join code DEMO-2026
// Password for all three: Demo@1234. Presentation only: delete or change before real use.
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { closeDb, db } from '../lib/server/db';
import {
  analyses,
  analysisShots,
  colleges,
  companies,
  companyRequirements,
  skillRecords,
  studentProfiles,
  testAttempts,
  users,
  type StoredAnalysis,
} from '../lib/server/db/schema';
import { newAnonCode } from '../lib/server/codes';
import { scrubHighlights } from '../lib/redact';

export const DEMO_PASSWORD = 'Demo@1234';
export const DEMO_JOIN_CODE = 'DEMO-2026';
export const DEMO = { student: 'student@demo.com', company: 'company@demo.com', college: 'college@demo.com' };
const DAY = 86400000;

async function upsertUser(email: string, role: 'student' | 'company' | 'college', name: string, passwordHash: string) {
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (u) {
    await db.update(users).set({ role, name, passwordHash }).where(eq(users.id, u.id));
    return u.id;
  }
  const [n] = await db.insert(users).values({ email, role, name, passwordHash }).returning({ id: users.id });
  return n.id;
}

async function main() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const now = Date.now();

  // College (stable id + join code).
  const collegeId = await upsertUser(DEMO.college, 'college', 'Demo Institute of Technology', hash);
  const collegeRow = { collegeName: 'Demo Institute of Technology', city: 'Pune', state: 'Maharashtra', joinCode: DEMO_JOIN_CODE };
  const [c] = await db.select({ id: colleges.userId }).from(colleges).where(eq(colleges.userId, collegeId));
  if (c) await db.update(colleges).set(collegeRow).where(eq(colleges.userId, collegeId));
  else await db.insert(colleges).values({ userId: collegeId, ...collegeRow });

  // Company with ONE open requirement.
  const companyId = await upsertUser(DEMO.company, 'company', 'TechNova Pvt Ltd hiring team', hash);
  const companyRow = { companyName: 'TechNova Pvt Ltd', website: 'https://technova.example', industry: 'Software products', sizeBand: '51-200' };
  const [co] = await db.select({ id: companies.userId }).from(companies).where(eq(companies.userId, companyId));
  if (co) await db.update(companies).set(companyRow).where(eq(companies.userId, companyId));
  else await db.insert(companies).values({ userId: companyId, ...companyRow });
  await db.delete(companyRequirements).where(eq(companyRequirements.companyId, companyId));
  await db.insert(companyRequirements).values({
    companyId,
    roleTitle: 'Junior Web Developer',
    experienceLevel: 'fresher',
    openings: 3,
    minOverallScore: 70,
    status: 'open',
    skills: [
      { skill: 'javascript', weight: 5, mustHave: true },
      { skill: 'react', weight: 5, mustHave: true },
      { skill: 'node.js', weight: 4, mustHave: false },
      { skill: 'sql', weight: 3, mustHave: false },
      { skill: 'git', weight: 2, mustHave: false },
    ],
  });

  // Student: re-created each run (cascade removes old analysis, tests, skills, invites).
  await db.delete(users).where(eq(users.email, DEMO.student));
  const studentId = await upsertUser(DEMO.student, 'student', 'Aarav Sharma', hash);
  const fixture = JSON.parse(fs.readFileSync(path.join('scripts', 'fixtures', 'analysis-web.json'), 'utf8')) as StoredAnalysis & {
    resumeSkills: string[];
    highlights: string[];
  };
  const { resumeSkills, highlights, ...result } = fixture;
  const testedAt = new Date(now - 5 * DAY); // retake cooldown (3 days) already over
  const verifiedUntil = new Date(testedAt.getTime() + 365 * DAY);

  await db.insert(studentProfiles).values({
    userId: studentId,
    collegeId,
    gradYear: 2026,
    educationLevel: 'B.Tech',
    visibleToCompanies: true,
    anonCode: newAnonCode(),
    latestOverallScore: result.overallScore,
    scoreBreakdown: result.subScores,
    redactedHighlights: scrubHighlights(highlights, { name: 'Aarav Sharma', email: DEMO.student, collegeName: collegeRow.collegeName }),
    testScorePct: 80,
    verified: true,
    distinction: false,
    verifiedUntil,
    analysedAt: new Date(now - 6 * DAY),
  });

  // Saved analysis (one real run, see scripts/make-fixture.ts) + its proof screenshots as webp.
  const [an] = await db.insert(analyses).values({ studentId, result }).returning({ id: analyses.id });
  const v = an.id.slice(0, 8);
  for (let i = 0; i < 3; i++) {
    const file = path.join('scripts', 'fixtures', 'analysis-web-shots', `${i}.jpg`);
    if (fs.existsSync(file)) {
      await db.insert(analysisShots).values({ analysisId: an.id, idx: i, bytes: await sharp(fs.readFileSync(file)).webp({ quality: 70 }).toBuffer() });
      result.proofCards[i].shotUrl = `/api/student/shot/${i}?v=${v}`;
    } else result.proofCards[i].shotUrl = null;
  }
  await db.update(analyses).set({ result }).where(eq(analyses.id, an.id));

  // Tested skills: 12 of 15 correct = 80%. A skill is verified at >= 67%.
  const tested = [
    { skill: 'javascript', correct: 3, total: 3 },
    { skill: 'react', correct: 2, total: 3 },
    { skill: 'node.js', correct: 2, total: 3 },
    { skill: 'sql', correct: 3, total: 3 },
    { skill: 'git', correct: 2, total: 3 },
  ].map((t) => ({ ...t, scorePct: Math.round((t.correct / t.total) * 100), verified: t.correct * 3 >= t.total * 2 }));
  await db.insert(testAttempts).values({
    studentId,
    status: 'submitted',
    generatedAt: new Date(testedAt.getTime() - 3600_000),
    startedAt: new Date(testedAt.getTime() - 1400_000),
    submittedAt: testedAt,
    durationSec: 1380,
    totalQ: 15,
    correct: 12,
    scorePct: 80,
    verified: true,
    distinction: false,
    skills: tested,
  });
  const allSkills = [...new Set([...resumeSkills, ...tested.map((t) => t.skill)])];
  await db.insert(skillRecords).values(
    allSkills.map((skill) => {
      const t = tested.find((x) => x.skill === skill);
      return {
        studentId,
        skill,
        inResume: resumeSkills.includes(skill),
        tested: !!t,
        verified: !!t?.verified,
        scorePct: t?.scorePct ?? null,
        questionsCorrect: t?.correct ?? null,
        questionsTotal: t?.total ?? null,
        lastTestedAt: t ? testedAt : null,
        expiresAt: t?.verified ? verifiedUntil : null,
      };
    }),
  );

  console.log('Demo accounts ready (password Demo@1234):');
  console.log(`  Student  ${DEMO.student}  Aarav Sharma, verified 80%, visible, linked to ${DEMO_JOIN_CODE}`);
  console.log(`  Company  ${DEMO.company}  TechNova Pvt Ltd, 1 open requirement (Junior Web Developer)`);
  console.log(`  College  ${DEMO.college}  Demo Institute of Technology, join code ${DEMO_JOIN_CODE}`);
  await closeDb();
}

main().catch(async (e) => {
  console.error('Demo seed failed:', e instanceof Error ? e.message : e);
  await closeDb();
  process.exit(1);
});
