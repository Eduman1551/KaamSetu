// Drizzle schema (Neon Postgres). snake_case columns, uuid primary keys.
// Raw resume files and raw resume text are NEVER stored: only structured data.
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import type { AnalysisResult } from '@/lib/types';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});
const ts = (name: string) => timestamp(name, { withTimezone: true });

export const roleEnum = pgEnum('role', ['student', 'company', 'college']);
export const attemptStatusEnum = pgEnum('attempt_status', ['ready', 'in_progress', 'submitted', 'expired', 'flagged']);
export const difficultyEnum = pgEnum('difficulty', ['medium', 'hard', 'expert']);
export const experienceEnum = pgEnum('experience_level', ['fresher', '0-2y']);
export const requirementStatusEnum = pgEnum('requirement_status', ['open', 'closed']);
export const inviteStatusEnum = pgEnum('invite_status', ['pending', 'accepted', 'declined']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(), // always stored lowercase
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull(),
  name: text('name').notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
  lastLoginAt: ts('last_login_at'),
});

export const colleges = pgTable('colleges', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  collegeName: text('college_name').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  joinCode: text('join_code').notNull().unique(),
  createdAt: ts('created_at').defaultNow().notNull(),
});

export interface ScoreBreakdown {
  skillsMatch: number;
  atsReadability: number;
  impact: number;
  structure: number;
}

export const studentProfiles = pgTable(
  'student_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    collegeId: uuid('college_id').references(() => colleges.userId, { onDelete: 'set null' }),
    gradYear: integer('grad_year').notNull(),
    educationLevel: text('education_level').notNull(),
    visibleToCompanies: boolean('visible_to_companies').default(false).notNull(),
    anonCode: text('anon_code').notNull().unique(),
    latestOverallScore: integer('latest_overall_score'),
    scoreBreakdown: jsonb('score_breakdown').$type<ScoreBreakdown>(),
    redactedHighlights: jsonb('redacted_highlights').$type<string[]>(),
    isSynthetic: boolean('is_synthetic').default(false).notNull(),
    // Verification status (updated when a test is submitted).
    testScorePct: integer('test_score_pct'),
    verified: boolean('verified').default(false).notNull(),
    distinction: boolean('distinction').default(false).notNull(),
    verifiedUntil: ts('verified_until'),
    analysedAt: ts('analysed_at'),
    createdAt: ts('created_at').defaultNow().notNull(),
    updatedAt: ts('updated_at').defaultNow().notNull(),
  },
  (t) => [index('student_profiles_college_visible_idx').on(t.collegeId, t.visibleToCompanies)],
);

/** Saved analysis result + the core skills chosen for the skills test. */
export type StoredAnalysis = AnalysisResult & { coreSkills: string[] };

export const analyses = pgTable('analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  // unique: only the latest analysis per student is kept
  studentId: uuid('student_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  result: jsonb('result').$type<StoredAnalysis>().notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
});

export const analysisShots = pgTable(
  'analysis_shots',
  {
    analysisId: uuid('analysis_id')
      .notNull()
      .references(() => analyses.id, { onDelete: 'cascade' }),
    idx: integer('idx').notNull(),
    bytes: bytea('bytes').notNull(), // compressed webp
  },
  (t) => [primaryKey({ columns: [t.analysisId, t.idx] })],
);

export const skillRecords = pgTable(
  'skill_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    skill: text('skill').notNull(), // normalised lowercase
    inResume: boolean('in_resume').default(false).notNull(),
    tested: boolean('tested').default(false).notNull(),
    verified: boolean('verified').default(false).notNull(),
    scorePct: integer('score_pct'),
    questionsCorrect: integer('questions_correct'),
    questionsTotal: integer('questions_total'),
    lastTestedAt: ts('last_tested_at'),
    expiresAt: ts('expires_at'),
    createdAt: ts('created_at').defaultNow().notNull(),
  },
  (t) => [unique('skill_records_student_skill_uq').on(t.studentId, t.skill), index('skill_records_skill_verified_idx').on(t.skill, t.verified)],
);

export interface AttemptSkill {
  skill: string;
  correct: number;
  total: number;
  scorePct: number;
  verified: boolean;
}

export const testAttempts = pgTable(
  'test_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: attemptStatusEnum('status').notNull(),
    generatedAt: ts('generated_at').defaultNow().notNull(),
    startedAt: ts('started_at'),
    submittedAt: ts('submitted_at'),
    durationSec: integer('duration_sec'),
    totalQ: integer('total_q').notNull(),
    correct: integer('correct'),
    scorePct: integer('score_pct'),
    verified: boolean('verified').default(false).notNull(),
    distinction: boolean('distinction').default(false).notNull(),
    skills: jsonb('skills').$type<AttemptSkill[]>().notNull(),
    tabSwitches: integer('tab_switches').default(0).notNull(),
    flagged: boolean('flagged').default(false).notNull(),
    createdAt: ts('created_at').defaultNow().notNull(),
  },
  (t) => [index('test_attempts_student_idx').on(t.studentId)],
);

export const testQuestions = pgTable(
  'test_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => testAttempts.id, { onDelete: 'cascade' }),
    idx: integer('idx').notNull(),
    skill: text('skill').notNull(),
    difficulty: difficultyEnum('difficulty').notNull(),
    question: text('question').notNull(),
    options: jsonb('options').$type<string[]>().notNull(),
    correctIndex: integer('correct_index').notNull(), // never sent to the client before submit
    explanation: text('explanation').notNull(), // never sent to the client before submit
    questionHash: text('question_hash').notNull(),
    studentAnswer: integer('student_answer'),
    isCorrect: boolean('is_correct'),
    markedForReview: boolean('marked_for_review').default(false).notNull(),
    createdAt: ts('created_at').defaultNow().notNull(),
  },
  (t) => [index('test_questions_attempt_idx').on(t.attemptId), index('test_questions_hash_idx').on(t.questionHash)],
);

export const companies = pgTable('companies', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  companyName: text('company_name').notNull(),
  website: text('website'),
  industry: text('industry').notNull(),
  sizeBand: text('size_band').notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
});

export interface RequirementSkill {
  skill: string;
  weight: number; // 1-5
  mustHave: boolean;
}

export const companyRequirements = pgTable(
  'company_requirements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.userId, { onDelete: 'cascade' }),
    roleTitle: text('role_title').notNull(),
    experienceLevel: experienceEnum('experience_level').notNull(),
    openings: integer('openings').default(1).notNull(),
    minOverallScore: integer('min_overall_score').default(70).notNull(),
    skills: jsonb('skills').$type<RequirementSkill[]>().notNull(),
    status: requirementStatusEnum('status').default('open').notNull(),
    createdAt: ts('created_at').defaultNow().notNull(),
  },
  (t) => [index('company_requirements_company_idx').on(t.companyId)],
);

export const invites = pgTable(
  'invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.userId, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    requirementId: uuid('requirement_id').references(() => companyRequirements.id, { onDelete: 'set null' }),
    message: text('message').notNull(),
    status: inviteStatusEnum('status').default('pending').notNull(),
    createdAt: ts('created_at').defaultNow().notNull(),
    respondedAt: ts('responded_at'),
  },
  (t) => [unique('invites_company_student_req_uq').on(t.companyId, t.studentId, t.requirementId).nullsNotDistinct()],
);

/** Cached Groq-generated workshop suggestions for a college's priority gaps. */
export interface WorkshopPlan {
  title: string;
  topics: string[];
  duration: string;
  audience: string;
}

export const workshops = pgTable(
  'workshops',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    collegeId: uuid('college_id')
      .notNull()
      .references(() => colleges.userId, { onDelete: 'cascade' }),
    skill: text('skill').notNull(),
    plan: jsonb('plan').$type<WorkshopPlan>().notNull(),
    createdAt: ts('created_at').defaultNow().notNull(),
  },
  (t) => [unique('workshops_college_skill_uq').on(t.collegeId, t.skill)],
);
