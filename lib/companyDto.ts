// The ONLY shape of student data a company ever receives (before an invite is accepted).
// Built with an explicit allow-list: anything not listed here can never leak.

export interface CandidateSkill {
  skill: string;
  scorePct: number;
  verified: boolean;
}

export interface CompanyCandidateDTO {
  anonCode: string;
  gradYear: number;
  educationLevel: string;
  overallScore: number; // overall skills-test %
  verified: boolean;
  distinction: boolean;
  skills: CandidateSkill[];
  highlights: string[]; // redacted bullets
}

/** Raw row from the database (may contain private fields — they are dropped here). */
export interface CandidateSource {
  anonCode: string;
  gradYear: number;
  educationLevel: string;
  testScorePct: number | null;
  verified: boolean;
  distinction: boolean;
  verifiedUntil: Date | string | null;
  redactedHighlights: string[] | null;
  skills: { skill: string; scorePct: number | null; verified: boolean; tested: boolean; expiresAt?: Date | string | null }[];
  [other: string]: unknown; // name, email, userId, collegeId, ... are ignored
}

export function toCompanyCandidateDTO(src: CandidateSource, now = new Date()): CompanyCandidateDTO {
  const until = src.verifiedUntil ? new Date(src.verifiedUntil) : null;
  const verified = !!src.verified && !!until && until > now;
  return {
    anonCode: String(src.anonCode),
    gradYear: Number(src.gradYear),
    educationLevel: String(src.educationLevel),
    overallScore: Number(src.testScorePct ?? 0),
    verified,
    distinction: verified && !!src.distinction,
    skills: src.skills
      .filter((s) => s.tested && s.scorePct != null)
      .map((s) => ({
        skill: String(s.skill),
        scorePct: Number(s.scorePct),
        verified: !!s.verified && (!s.expiresAt || new Date(s.expiresAt) > now),
      }))
      .sort((a, b) => b.scorePct - a.scorePct),
    highlights: (src.redactedHighlights ?? []).slice(0, 5).map(String),
  };
}
