// The analysis pipeline. Each step reports progress through `send` (SSE).
import type { AnalysisResult, ProgressEvent } from '@/lib/types';
import { env } from './env';
import { atsChecks, extractPdfText } from './resume';
import { readProfile } from './profile';

type Send = (ev: ProgressEvent) => void;

export class FriendlyError extends Error {}

/** Map low-level errors to messages a first-time user understands. */
export function friendly(err: unknown): Error {
  if (err instanceof FriendlyError) return err;
  const e = err as { status?: number; message?: string };
  if (e?.status === 429) return new FriendlyError('The AI service is busy right now (rate limit). Please try again in a minute, or use the demo result.');
  if (e?.status === 401) return new FriendlyError('The AI key on the server is invalid. Check GROQ_API_KEY in .env.local.');
  if (e?.status && e.status >= 500) return new FriendlyError('The AI service had a hiccup. Please try again.');
  return new FriendlyError(e?.message || 'Something went wrong during analysis.');
}

export async function runPipeline(
  pdf: Buffer,
  sessionId: string,
  send: Send,
  isCancelled: () => boolean,
): Promise<AnalysisResult> {
  const step = (id: string, label: string, status: 'active' | 'done' = 'active') => send({ type: 'step', id, label, status });
  const progress = (pct: number) => send({ type: 'progress', pct });
  const waitNote = (id: string, label: string) => (s: number) => step(id, `${label} (AI is busy, waiting ${s}s…)`);

  try {
    // 1. Read the PDF in memory.
    step('read', 'Reading your resume…');
    const { text, pages } = await extractPdfText(pdf);
    if (text.split(/\s+/).length < 40) {
      throw new FriendlyError('We could not read text from this PDF. If it is a scanned image, please export a text-based PDF.');
    }
    const ats = atsChecks(text, pages);
    progress(5);

    // 2. AI reads the resume.
    const profile = await readProfile(text, waitNote('read', 'Reading your resume…'));
    step('read', `Read your resume — target roles: ${profile.targetRoles.join(', ')}`, 'done');
    progress(12);
    if (isCancelled()) throw new FriendlyError('Cancelled');

    // (Listing search + analysis is added in the next milestone.)
    return {
      sessionId,
      demo: false,
      generatedAt: new Date().toISOString(),
      targetRoles: profile.targetRoles,
      educationLevel: profile.educationLevel,
      overallScore: ats.score,
      subScores: { skillsMatch: 0, atsReadability: ats.score, impact: 0, structure: 0 },
      summary: `Skills found: ${profile.skills.join(', ')}`,
      strengths: [],
      skillsToAdd: [],
      atsTips: ats.tips,
      proofCards: [],
      listingsAnalyzed: { count: 0, sources: [] },
      ttlMinutes: env.sessionTtlMinutes,
    };
  } catch (err) {
    throw friendly(err);
  }
}
