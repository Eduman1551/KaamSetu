// pnpm seed:sample — OPTIONAL. Adds ~40 clearly synthetic students (is_synthetic = true,
// emails @seed.kaamsetu.test, cannot log in) linked to the demo college, so the company and
// college dashboards can be shown with fuller data. Not run by default; not part of deploy.
// Run after pnpm db:seed:demo. Idempotent: replaces previously generated sample students only.
// `pnpm seed:sample --remove` deletes them again.
import { eq, like } from 'drizzle-orm';
import { closeDb, db } from '../lib/server/db';
import { colleges, skillRecords, studentProfiles, testAttempts, users } from '../lib/server/db/schema';
import { newAnonCode } from '../lib/server/codes';
import { VERIFICATION_MONTHS } from '../lib/server/testConfig';
import { scoreAttempt } from '../lib/scoring';

const SYNTH_DOMAIN = '@seed.kaamsetu.test';
const COUNT = 40;
const DEMO_JOIN_CODE = 'DEMO-2026';

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


async function main() {
  const now = Date.now();
  const [college] = await db.select({ id: colleges.userId }).from(colleges).where(eq(colleges.joinCode, DEMO_JOIN_CODE));
  if (!college) throw new Error('Demo college not found. Run pnpm db:seed:demo first.');
  const collegeId = college.id;
  const removed = await db.delete(users).where(like(users.email, `%${SYNTH_DOMAIN}`)).returning({ id: users.id });
  if (process.argv.includes('--remove')) {
    console.log(`Removed ${removed.length} sample students. Real and demo accounts were not touched.`);
    return closeDb();
  }

  const synthHash = '!synthetic-account-no-login';
  const trackNames = Object.keys(TRACKS);
  const studentIds: { id: string; visible: boolean; verified: boolean }[] = [];
  for (let i = 1; i <= COUNT; i++) {
    const track = trackNames[i % 3];
    const T = TRACKS[track];
    const core = pick(CORE[track]);
    const ability = Math.max(0.35, Math.min(0.97, 0.76 + gauss() * 0.22));
    const linked = i <= COUNT - 4;
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


  const verified = studentIds.filter((s) => s.verified).length;
  console.log(`Sample data: removed ${removed.length} old sample students, added ${COUNT} (${verified} verified, ${studentIds.filter((s) => s.visible).length} visible).`);
  await closeDb();
}

main().catch(async (e) => {
  console.error('Sample seed failed:', e instanceof Error ? e.message : e);
  await closeDb();
  process.exit(1);
});
