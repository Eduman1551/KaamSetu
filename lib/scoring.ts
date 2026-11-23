// Pure, unit-tested business rules (no database, no network).
import {
  DISTINCTION_MARK,
  MAX_ATTEMPTS_PER_30_DAYS,
  MAX_CORE_SKILLS,
  PASS_MARK,
  RETAKE_COOLDOWN_DAYS,
  TAB_SWITCH_FLAG,
  TOTAL_QUESTIONS,
} from './server/testConfig';

const DAY = 24 * 3600 * 1000;

/** How many questions each core skill gets so the total is always 15. */
export function questionSplit(skillCount: number): number[] {
  const n = Math.min(MAX_CORE_SKILLS, skillCount);
  if (n < 3) return [];
  const base = Math.floor(TOTAL_QUESTIONS / n);
  const extra = TOTAL_QUESTIONS - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

/** A skill is verified with at least 2/3 of its questions correct (2 of 3, 3 of 4, 4 of 5). */
export function skillVerified(correct: number, total: number) {
  return total > 0 && correct * 3 >= total * 2;
}

export interface GradedQuestion {
  skill: string;
  isCorrect: boolean;
}

export function scoreAttempt(questions: GradedQuestion[], tabSwitches: number) {
  const bySkill = new Map<string, { correct: number; total: number }>();
  for (const q of questions) {
    const s = bySkill.get(q.skill) ?? { correct: 0, total: 0 };
    s.total++;
    if (q.isCorrect) s.correct++;
    bySkill.set(q.skill, s);
  }
  const correct = questions.filter((q) => q.isCorrect).length;
  const total = questions.length;
  const flagged = tabSwitches >= TAB_SWITCH_FLAG;
  const passed = correct >= PASS_MARK;
  return {
    correct,
    total,
    scorePct: total ? Math.round((correct / total) * 100) : 0,
    flagged,
    // A flagged attempt never grants verification.
    verified: passed && !flagged,
    distinction: correct >= DISTINCTION_MARK && !flagged,
    skills: [...bySkill.entries()].map(([skill, s]) => ({
      skill,
      correct: s.correct,
      total: s.total,
      scorePct: Math.round((s.correct / s.total) * 100),
      verified: !flagged && skillVerified(s.correct, s.total),
    })),
  };
}

/**
 * Can the student start a new attempt? Rules: 3-day cooldown after a submitted
 * attempt; at most 3 attempts per rolling 30 days.
 */
export function retakeStatus(submittedAt: Date[], now = new Date()): { allowed: boolean; nextAt: Date | null; reason?: string } {
  const sorted = [...submittedAt].sort((a, b) => b.getTime() - a.getTime());
  const last = sorted[0];
  let nextAt: Date | null = null;
  let reason: string | undefined;
  if (last) {
    const cool = new Date(last.getTime() + RETAKE_COOLDOWN_DAYS * DAY);
    if (cool > now) {
      nextAt = cool;
      reason = `You can retake after a ${RETAKE_COOLDOWN_DAYS}-day cooldown.`;
    }
  }
  const recent = sorted.filter((d) => now.getTime() - d.getTime() < 30 * DAY);
  if (recent.length >= MAX_ATTEMPTS_PER_30_DAYS) {
    const freeAt = new Date(recent[MAX_ATTEMPTS_PER_30_DAYS - 1].getTime() + 30 * DAY);
    if (!nextAt || freeAt > nextAt) {
      nextAt = freeAt;
      reason = `Maximum ${MAX_ATTEMPTS_PER_30_DAYS} attempts in 30 days.`;
    }
  }
  return { allowed: !nextAt, nextAt, reason };
}

export interface ReqSkill {
  skill: string;
  weight: number;
  mustHave: boolean;
}
export interface CandSkill {
  skill: string;
  scorePct: number;
  verified: boolean;
}

/**
 * Match % = sum(weight x verified skill score fraction) / sum(weight) x 100.
 * A skill that is not verified counts as 0.
 */
export function matchPercent(req: ReqSkill[], cand: CandSkill[]) {
  const map = new Map(cand.map((c) => [c.skill.toLowerCase(), c]));
  let num = 0;
  let den = 0;
  const missingMustHave: string[] = [];
  for (const r of req) {
    const c = map.get(r.skill.toLowerCase());
    const frac = c && c.verified ? c.scorePct / 100 : 0;
    num += r.weight * frac;
    den += r.weight;
    if (r.mustHave && !(c && c.verified)) missingMustHave.push(r.skill);
  }
  return { pct: den ? Math.round((num / den) * 100) : 0, missingMustHave };
}

/** Gap index = demand% x (100 - avg score%) / 100. */
export function gapIndex(demandPct: number, avgScorePct: number) {
  return Math.round(((demandPct * (100 - avgScorePct)) / 100) * 10) / 10;
}

/** k-anonymity: show a statistic only when at least K students contribute. */
export const K_MIN = 5;
export function suppress<T>(count: number, value: T): T | null {
  return count >= K_MIN ? value : null;
}
