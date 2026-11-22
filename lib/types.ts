// Shared types used by both the API routes and the React components.
// (No server-only imports here.)

export interface Course {
  title: string;
  platform: string;
  url: string;
  free: boolean;
  /** Only set when the course page states its length. */
  hours: number | null;
}

export interface SkillCount {
  skill: string;
  /** Number of listings that mention this skill. */
  count: number;
}

export interface SkillToAdd extends SkillCount {
  courses: Course[];
}

export interface AtsTip {
  text: string;
  /** true = already fine (tick), false = needs a fix (warning). */
  pass: boolean;
}

export interface ProofCardData {
  skill: string;
  count: number;
  total: number;
  /** true when the skill is missing from the resume. */
  missing: boolean;
  company: string;
  jobTitle: string;
  url: string;
  scannedAt: string; // ISO date
  /** URL of the real screenshot, or null when the text fallback is shown. */
  shotUrl: string | null;
  /** The exact sentence from the listing that mentions the skill. */
  sentence: string;
}

export interface SubScores {
  skillsMatch: number;
  atsReadability: number;
  impact: number;
  structure: number;
}

export interface AnalysisResult {
  sessionId: string;
  demo: boolean;
  generatedAt: string;
  targetRoles: string[];
  educationLevel: string;
  overallScore: number;
  subScores: SubScores;
  summary: string;
  strengths: SkillCount[];
  skillsToAdd: SkillToAdd[];
  atsTips: AtsTip[];
  proofCards: ProofCardData[];
  listingsAnalyzed: { count: number; sources: string[] };
  /** Minutes until the server auto-deletes this session. */
  ttlMinutes: number;
}

/** Server-sent progress events streamed by POST /api/analyze. */
export type ProgressEvent =
  | { type: 'step'; id: string; label: string; status: 'active' | 'done' }
  | { type: 'progress'; pct: number }
  | { type: 'result'; result: AnalysisResult }
  | { type: 'error'; message: string };
