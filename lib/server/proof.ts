// Proof cards: exactly 3 skills, each backed by a real listing sentence.
import type { ProofCardData } from '@/lib/types';

export interface ProofEvidence {
  url: string;
  company: string;
  jobTitle: string;
  quote: string;
  sentence: string;
}

export interface ProofCandidate {
  skill: string;
  count: number;
  missing: boolean;
  /** frequency in listings x relevance to the target role */
  priority: number;
  evidence: ProofEvidence[];
}

/**
 * Pick the 3 most important skills by priority, making sure at least 2 of them
 * are missing from the resume.
 */
export function pickProofSkills(cands: ProofCandidate[]): ProofCandidate[] {
  const usable = cands.filter((c) => c.evidence.length > 0).sort((a, b) => b.priority - a.priority || b.count - a.count);
  const picked = usable.slice(0, 3);
  const missingNeeded = 2 - picked.filter((c) => c.missing).length;
  if (missingNeeded > 0) {
    const extraMissing = usable.filter((c) => c.missing && !picked.includes(c)).slice(0, missingNeeded);
    for (const m of extraMissing) {
      // Replace the lowest-priority skill the student already has.
      const idx = picked.map((p) => p.missing).lastIndexOf(false);
      if (idx >= 0) picked[idx] = m;
    }
  }
  return picked.sort((a, b) => b.priority - a.priority);
}

/** Build the 3 proof cards (text-only for now; screenshots are added in proof screenshots). */
export async function buildProofCards(
  cands: ProofCandidate[],
  total: number,
  _sessionId: string,
  _isCancelled: () => boolean,
): Promise<ProofCardData[]> {
  const chosen = pickProofSkills(cands);
  const scannedAt = new Date().toISOString();
  const usedUrls = new Set<string>();
  return chosen.map((c) => {
    // Prefer a listing not already used by another card, so the 3 cards show 3 companies.
    const ev = c.evidence.find((e) => !usedUrls.has(e.url)) ?? c.evidence[0];
    usedUrls.add(ev.url);
    return {
      skill: c.skill,
      count: c.count,
      total,
      missing: c.missing,
      company: ev.company,
      jobTitle: ev.jobTitle,
      url: ev.url,
      scannedAt,
      shotUrl: null,
      sentence: ev.sentence,
    };
  });
}
