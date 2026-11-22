// Proof cards: exactly 3 skills, each backed by a real listing sentence and,
// when possible, a real screenshot of that listing with the sentence highlighted.
import fs from 'fs/promises';
import type { ProofCardData } from '@/lib/types';
import { env } from './env';
import { captureProof } from './screenshot';
import { newShotPath, registerShot } from './shots';

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

const MAX_TRIES_PER_SKILL = 3;

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

/** Build the 3 proof cards. Screenshots run in parallel (one per card). */
export async function buildProofCards(
  cands: ProofCandidate[],
  total: number,
  sessionId: string,
  isCancelled: () => boolean,
): Promise<ProofCardData[]> {
  const chosen = pickProofSkills(cands);
  const scannedAt = new Date().toISOString();

  // Give each card its own listing order, preferring listings not used by an
  // earlier card, so the 3 cards usually show 3 different companies.
  const claimed = new Set<string>();
  const orders = chosen.map((c) => {
    const fresh = c.evidence.filter((e) => !claimed.has(e.url));
    const order = [...fresh, ...c.evidence.filter((e) => claimed.has(e.url))];
    if (order[0]) claimed.add(order[0].url);
    return order;
  });

  return Promise.all(
    chosen.map(async (c, i): Promise<ProofCardData> => {
      const base = { skill: c.skill, count: c.count, total, missing: c.missing, scannedAt };
      // Try the best listing first; if blocked or the sentence can't be found, try the next one.
      for (const ev of orders[i].slice(0, MAX_TRIES_PER_SKILL)) {
        if (isCancelled()) break;
        const jpg = await captureProof(ev.url, ev.quote, env.screenshotTimeoutMs);
        if (!jpg) continue;
        const { token, file } = await newShotPath(sessionId);
        await fs.writeFile(file, jpg);
        registerShot(token, file, sessionId);
        return { ...base, company: ev.company, jobTitle: ev.jobTitle, url: ev.url, sentence: ev.sentence, shotUrl: `/api/shot/${token}` };
      }
      // All failed: text card with the exact extracted sentence.
      const ev = orders[i][0];
      return { ...base, company: ev.company, jobTitle: ev.jobTitle, url: ev.url, sentence: ev.sentence, shotUrl: null };
    }),
  );
}
