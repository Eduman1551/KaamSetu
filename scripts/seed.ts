// pnpm seed — sample data for the dashboards and the class demo.
// Idempotent: it only creates/replaces rows owned by the reserved
// "kaamsetu.test" email domains and synthetic students. Real users are never touched.
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { eq, inArray, like, or } from 'drizzle-orm';
import { closeDb, db } from '../lib/server/db';
import {
  analyses,
  analysisShots,
  colleges,
  companies,
  companyRequirements,
  invites,
  skillRecords,
  studentProfiles,
  testAttempts,
  users,
  type RequirementSkill,
  type StoredAnalysis,
} from '../lib/server/db/schema';
import { newAnonCode } from '../lib/server/codes';
import { PASS_MARK, VERIFICATION_MONTHS } from '../lib/server/testConfig';
import { scoreAttempt } from '../lib/scoring';

export const DEMO_PASSWORD = 'KaamSetu@2026';
const DEMO = {
  student: 'student.demo@kaamsetu.test',
  company: 'company.demo@kaamsetu.test',
  college: 'college.demo@kaamsetu.test',
};
const SYNTH_DOMAIN = '@seed.kaamsetu.test';
const COLLEGE_JOIN_CODE = 'KIT-7F3A9';

// Deterministic pseudo-random numbers so every seed run looks the same.
let state = 20261123;
const rnd = () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 2; // ~N(0, 0.58)
const DAY = 86400000;

// Tracks with per-skill difficulty offsets (Docker and System Design are clear weak spots).
const TRACKS: Record<string, { skills: string[]; difficulty: Record<string, number> }> = {
  web: {
    skills: ['javascript', 'react', 'node.js', 'html', 'css', 'sql', 'git', 'docker', 'rest apis', 'system design'],
    difficulty: { docker: 0.3, 'system design': 0.33, react: 0.05, 'node.js': 0.08 },
  },
  data: {
    skills: ['python', 'sql', 'excel', 'power bi', 'pandas', 'statistics', 'tableau', 'machine learning', 'docker'],
    difficulty: { statistics: 0.15, 'machine learning': 0.2, docker: 0.3, 'power bi': 0.05 },
  },
  java: {
    skills: ['java', 'spring boot', 'sql', 'oop', 'data structures', 'git', 'docker', 'system design'],
    difficulty: { 'spring boot': 0.12, 'data structures': 0.1, docker: 0.3, 'system design': 0.33 },
  },
};
const CORE: Record<string, string[][]> = {
  web: [
    ['javascript', 'react', 'node.js', 'sql', 'docker'],
    ['javascript', 'react', 'rest apis', 'git', 'system design'],
    ['javascript', 'html', 'css', 'react', 'docker'],
  ],
  data: [
    ['python', 'sql', 'excel', 'power bi', 'statistics'],
    ['python', 'sql', 'pandas', 'machine learning', 'docker'],
    ['python', 'excel', 'sql', 'tableau', 'statistics'],
  ],
  java: [
    ['java', 'spring boot', 'sql', 'oop', 'system design'],
    ['java', 'data structures', 'sql', 'docker', 'git'],
  ],
};
const HIGHLIGHTS: Record<string, string[]> = {
  web: [
    'Built a responsive web app with React and a REST backend used by 200+ students',
    'Created a full-stack project with authentication and a SQL database',
    'Improved page load time of a personal project by about 40%',
    'Completed a 2-month internship building UI components',
    'Contributed fixes to an open-source JavaScript library',
  ],
  data: [
    'Cleaned and analysed a dataset of 10,000+ rows to find sales trends',
    'Built an interactive dashboard to track monthly KPIs',
    'Trained a classification model with about 85% accuracy on a public dataset',
    'Automated a weekly spreadsheet report, saving about 3 hours per week',
    'Completed a data analytics internship at a mid-size firm',
  ],
  java: [
    'Built a REST API in Java with Spring Boot and a relational database',
    'Implemented common data structures and solved 300+ coding problems',
    'Designed a library management system using object-oriented principles',
    'Completed a backend development internship',
    'Wrote unit tests that raised coverage of a project to about 80%',
  ],
};
const EDUCATION = ['B.Tech Computer Science', 'B.E. Information Technology', 'BCA', 'MCA', 'B.Sc Computer Science', 'B.Tech Electronics'];

async function upsertUser(email: string, role: 'student' | 'company' | 'college', name: string, passwordHash: string) {
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) {
    await db.update(users).set({ name, passwordHash, role }).where(eq(users.id, existing.id));
    return existing.id;
  }
  const [u] = await db.insert(users).values({ email, role, name, passwordHash }).returning({ id: users.id });
  return u.id;
}

async function main() {
  const t0 = Date.now();
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const now = Date.now();

  // 1. Remove previously seeded students (cascades to their analyses, tests, skills, invites).
  await db.delete(users).where(or(like(users.email, `%${SYNTH_DOMAIN}`), eq(users.email, DEMO.student)));

  // 2. College (kept with a stable id + join code so real students' links survive re-seeding).
  const collegeId = await upsertUser(DEMO.college, 'college', 'Placement Cell', hash);
  const [col] = await db.select().from(colleges).where(eq(colleges.userId, collegeId));
  const collegeRow = { collegeName: 'Kaveri Institute of Technology', city: 'Bengaluru', state: 'Karnataka', joinCode: COLLEGE_JOIN_CODE };
  if (col) await db.update(colleges).set(collegeRow).where(eq(colleges.userId, collegeId));
  else await db.insert(colleges).values({ userId: collegeId, ...collegeRow });

  // 3. Companies (fictional) with 2 open requirements each.
  const companyDefs: { email: string; name: string; info: { website: string; industry: string; sizeBand: string }; reqs: { roleTitle: string; skills: RequirementSkill[] }[] }[] = [
    {
      email: DEMO.company,
      name: 'Nimbus Analytics',
      info: { website: 'https://nimbus-analytics.example', industry: 'Analytics & BI', sizeBand: '51-200' },
      reqs: [
        { roleTitle: 'Junior Data Analyst', skills: [{ skill: 'sql', weight: 5, mustHave: true }, { skill: 'python', weight: 4, mustHave: false }, { skill: 'excel', weight: 3, mustHave: false }, { skill: 'power bi', weight: 3, mustHave: false }, { skill: 'statistics', weight: 2, mustHave: false }] },
        { roleTitle: 'Associate ML Engineer', skills: [{ skill: 'python', weight: 5, mustHave: true }, { skill: 'machine learning', weight: 5, mustHave: true }, { skill: 'sql', weight: 3, mustHave: false }, { skill: 'docker', weight: 2, mustHave: false }] },
      ],
    },
    {
      email: 'hiring.kodekraft@kaamsetu.test',
      name: 'Kodekraft Labs',
      info: { website: 'https://kodekraft.example', industry: 'Software products', sizeBand: '11-50' },
      reqs: [
        { roleTitle: 'Frontend Developer (Fresher)', skills: [{ skill: 'javascript', weight: 5, mustHave: true }, { skill: 'react', weight: 5, mustHave: true }, { skill: 'css', weight: 3, mustHave: false }, { skill: 'git', weight: 2, mustHave: false }] },
        { roleTitle: 'Full-Stack Developer', skills: [{ skill: 'javascript', weight: 4, mustHave: true }, { skill: 'node.js', weight: 4, mustHave: false }, { skill: 'sql', weight: 3, mustHave: false }, { skill: 'docker', weight: 3, mustHave: false }, { skill: 'system design', weight: 2, mustHave: false }] },
      ],
    },
    {
      email: 'talent.trellis@kaamsetu.test',
      name: 'Trellis FinTech',
      info: { website: 'https://trellis-fintech.example', industry: 'Financial services', sizeBand: '201-1000' },
      reqs: [
        { roleTitle: 'Graduate Java Engineer', skills: [{ skill: 'java', weight: 5, mustHave: true }, { skill: 'spring boot', weight: 4, mustHave: false }, { skill: 'sql', weight: 4, mustHave: false }, { skill: 'oop', weight: 3, mustHave: false }, { skill: 'system design', weight: 2, mustHave: false }] },
        { roleTitle: 'Backend Engineer (0-2 yrs)', skills: [{ skill: 'java', weight: 4, mustHave: true }, { skill: 'sql', weight: 4, mustHave: true }, { skill: 'docker', weight: 3, mustHave: false }, { skill: 'data structures', weight: 3, mustHave: false }] },
      ],
    },
  ];
  const companyIds: string[] = [];
  const reqIds: string[] = [];
  for (const c of companyDefs) {
    const id = await upsertUser(c.email, 'company', `${c.name} hiring team`, hash);
    companyIds.push(id);
    const [ex] = await db.select().from(companies).where(eq(companies.userId, id));
    if (ex) await db.update(companies).set({ companyName: c.name, ...c.info }).where(eq(companies.userId, id));
    else await db.insert(companies).values({ userId: id, companyName: c.name, ...c.info });
    await db.delete(companyRequirements).where(eq(companyRequirements.companyId, id));
    for (const r of c.reqs) {
      const [row] = await db
        .insert(companyRequirements)
        .values({ companyId: id, roleTitle: r.roleTitle, experienceLevel: 'fresher', openings: 1 + Math.floor(rnd() * 4), minOverallScore: 70, skills: r.skills })
        .returning({ id: companyRequirements.id });
      reqIds.push(row.id);
    }
  }

  // 4. Synthetic students.
  const synthHash = '!synthetic-account-no-login';
  const trackNames = Object.keys(TRACKS);
  const studentIds: { id: string; visible: boolean; verified: boolean }[] = [];
  for (let i = 1; i <= 60; i++) {
    const track = trackNames[i % 3];
    const T = TRACKS[track];
    const core = pick(CORE[track]);
    const ability = Math.max(0.35, Math.min(0.97, 0.76 + gauss() * 0.22));
    const linked = i <= 52;
    const analysed = rnd() > 0.08;
    const tested = analysed && rnd() > 0.15;
    const email = `student${String(i).padStart(3, '0')}${SYNTH_DOMAIN}`;
    const [u] = await db.insert(users).values({ email, role: 'student', name: `Sample Student ${i}`, passwordHash: synthHash }).returning({ id: users.id });

    // Tests: 1-2 attempts spread over the last 6 months.
    const attempts: { at: Date; result: ReturnType<typeof scoreAttempt>; tabs: number }[] = [];
    if (tested) {
      const nAttempts = rnd() < 0.25 ? 2 : 1;
      let at = new Date(now - (10 + rnd() * 170) * DAY);
      for (let k = 0; k < nAttempts; k++) {
        const lift = k * 0.08; // a bit better on the retake
        const qs: { skill: string; isCorrect: boolean }[] = [];
        core.forEach((skill) => {
          for (let q = 0; q < 3; q++) qs.push({ skill, isCorrect: rnd() < ability + lift - (T.difficulty[skill] ?? 0) });
        });
        const tabs = rnd() < 0.05 ? 7 : Math.floor(rnd() * 3);
        attempts.push({ at, result: scoreAttempt(qs, tabs), tabs });
        at = new Date(Math.min(now - DAY, at.getTime() + (5 + rnd() * 20) * DAY));
      }
    }
    const last = attempts[attempts.length - 1];
    const verified = !!last && last.result.verified;
    const visible = verified && rnd() < 0.8;
    const analysedAt = new Date(now - (5 + rnd() * 175) * DAY);

    await db.insert(studentProfiles).values({
      userId: u.id,
      collegeId: linked ? collegeId : null,
      gradYear: pick([2025, 2026, 2026, 2027]),
      educationLevel: pick(EDUCATION),
      visibleToCompanies: visible,
      anonCode: newAnonCode(),
      latestOverallScore: analysed ? Math.round(45 + rnd() * 40) : null,
      scoreBreakdown: analysed ? { skillsMatch: Math.round(30 + rnd() * 50), atsReadability: Math.round(60 + rnd() * 40), impact: Math.round(40 + rnd() * 45), structure: Math.round(55 + rnd() * 40) } : null,
      redactedHighlights: analysed ? [...HIGHLIGHTS[track]].sort(() => rnd() - 0.5).slice(0, 3 + Math.floor(rnd() * 3)) : null,
      isSynthetic: true,
      testScorePct: last ? last.result.scorePct : null,
      verified,
      distinction: verified && last.result.distinction,
      verifiedUntil: verified ? new Date(last.at.getTime() + VERIFICATION_MONTHS * 30.4 * DAY) : null,
      analysedAt: analysed ? analysedAt : null,
    });

    for (const a of attempts) {
      await db.insert(testAttempts).values({
        studentId: u.id,
        status: a.result.flagged ? 'flagged' : 'submitted',
        generatedAt: new Date(a.at.getTime() - 3600_000),
        startedAt: new Date(a.at.getTime() - 1500_000),
        submittedAt: a.at,
        durationSec: 1100 + Math.floor(rnd() * 650),
        totalQ: 15,
        correct: a.result.correct,
        scorePct: a.result.scorePct,
        verified: a.result.verified,
        distinction: a.result.distinction,
        skills: a.result.skills,
        tabSwitches: a.tabs,
        flagged: a.result.flagged,
      });
    }

    // Skill records: resume skills (core + a couple more), test results from the last attempt.
    const resumeSkills = [...new Set([...core, ...T.skills.filter(() => rnd() < 0.3)])];
    if (analysed) {
      await db.insert(skillRecords).values(
        resumeSkills.map((skill) => {
          const t = last?.result.skills.find((s) => s.skill === skill);
          return {
            studentId: u.id,
            skill,
            inResume: true,
            tested: !!t,
            verified: !!t && t.verified,
            scorePct: t?.scorePct ?? null,
            questionsCorrect: t?.correct ?? null,
            questionsTotal: t?.total ?? null,
            lastTestedAt: t ? last!.at : null,
            expiresAt: t ? new Date(last!.at.getTime() + VERIFICATION_MONTHS * 30.4 * DAY) : null,
          };
        }),
      );
    }
    studentIds.push({ id: u.id, visible, verified });
  }

  // 5. A few invites from the companies to visible synthetic students.
  const visible = studentIds.filter((s) => s.visible);
  for (let k = 0; k < Math.min(9, visible.length); k++) {
    const ci = k % 3;
    await db.insert(invites).values({
      companyId: companyIds[ci],
      studentId: visible[k].id,
      requirementId: reqIds[ci * 2 + (k % 2)],
      message: 'Hi! Your verified skills match our opening. Would you like to talk?',
      status: k % 3 === 0 ? 'accepted' : k % 3 === 1 ? 'pending' : 'declined',
      createdAt: new Date(now - (k + 1) * 2 * DAY),
      respondedAt: k % 3 === 1 ? null : new Date(now - (k + 1) * DAY),
    });
  }

  // 6. Demo student login: linked to the college, with a saved analysis (from a real
  //    run, scripts/fixtures) and resume skills, but NOT yet tested, so the skills test can be shown live.
  const demoId = await upsertUser(DEMO.student, 'student', 'Aarav Mehta', hash);
  const fixture = JSON.parse(fs.readFileSync(path.join('scripts', 'fixtures', 'analysis.json'), 'utf8')) as StoredAnalysis;
  fixture.coreSkills = ['excel', 'python', 'java', 'javascript'];
  await db.insert(studentProfiles).values({
    userId: demoId,
    collegeId,
    gradYear: 2027,
    educationLevel: 'B.E. Computer Engineering',
    anonCode: newAnonCode(),
    latestOverallScore: fixture.overallScore,
    scoreBreakdown: fixture.subScores,
    redactedHighlights: [
      'Cleaned six months of sales data (12,000 rows) and found the top-selling items',
      'Built a desktop attendance tracker that exports records to spreadsheets',
      'Built a responsive personal portfolio website',
      'Completed a two-month data entry internship at a non-profit',
    ],
    isSynthetic: true,
    analysedAt: new Date(now - 2 * DAY),
  });
  const [an] = await db.insert(analyses).values({ studentId: demoId, result: fixture }).returning({ id: analyses.id });
  for (let i = 0; i < 3; i++) {
    const file = path.join('scripts', 'fixtures', 'shots', `${i + 1}.jpg`);
    if (!fs.existsSync(file)) continue;
    const webp = await sharp(fs.readFileSync(file)).webp({ quality: 72 }).toBuffer();
    await db.insert(analysisShots).values({ analysisId: an.id, idx: i, bytes: webp });
    fixture.proofCards[i].shotUrl = `/api/student/shot/${i}`;
  }
  await db.update(analyses).set({ result: fixture }).where(eq(analyses.id, an.id));
  const resumeSkills = ['excel', 'python', 'java', 'javascript', 'c++', 'pandas', 'numpy', 'matplotlib', 'html', 'css', 'communication', 'teamwork', 'problem solving'];
  await db.insert(skillRecords).values(resumeSkills.map((skill) => ({ studentId: demoId, skill, inResume: true })));

  // Sanity summary.
  const verifiedCount = studentIds.filter((s) => s.verified).length;
  const visibleCount = studentIds.filter((s) => s.visible).length;
  const reqCount = (await db.select({ id: companyRequirements.id }).from(companyRequirements).where(inArray(companyRequirements.companyId, companyIds))).length;
  console.log(
    `Seeded in ${((Date.now() - t0) / 1000).toFixed(1)}s: 1 college (${COLLEGE_JOIN_CODE}), ${companyIds.length} companies, ${reqCount} requirements, ` +
      `60 synthetic students (${verifiedCount} verified, ${visibleCount} visible; pass mark ${PASS_MARK}/15), 1 demo student.`,
  );
  console.log(`Logins (password ${DEMO_PASSWORD}): ${DEMO.student}, ${DEMO.company}, ${DEMO.college}`);
  await closeDb();
}

main().catch(async (e) => {
  console.error('Seed failed:', e instanceof Error ? e.message : e);
  await closeDb();
  process.exit(1);
});

