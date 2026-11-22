// In-memory sessions. Stored on globalThis so they survive Next.js dev hot reloads.
// Nothing here is written to disk; screenshots are temp files tracked in shots.ts.
import crypto from 'crypto';
import type { AnalysisResult } from '@/lib/types';
import { env } from './env';
import { deleteShotsForSession, sweepOrphanShots } from './shots';

export interface Session {
  id: string;
  createdAt: number;
  result: AnalysisResult | null;
}

const g = globalThis as unknown as { __ksSessions?: Map<string, Session>; __ksSweeper?: NodeJS.Timeout };
export const sessions: Map<string, Session> = g.__ksSessions ?? (g.__ksSessions = new Map());

export function createSession(): Session {
  const s: Session = { id: crypto.randomBytes(16).toString('hex'), createdAt: Date.now(), result: null };
  sessions.set(s.id, s);
  return s;
}

export function getSession(id: string) {
  return sessions.get(id);
}

/** Remove a session and its screenshot files. Returns true if it existed. */
export async function deleteSession(id: string): Promise<boolean> {
  const existed = sessions.delete(id);
  await deleteShotsForSession(id);
  return existed;
}

// Auto-delete sessions after SESSION_TTL_MINUTES (checked once a minute).
if (!g.__ksSweeper) {
  g.__ksSweeper = setInterval(() => {
    const cutoff = Date.now() - env.sessionTtlMinutes * 60_000;
    for (const [id, s] of sessions) if (s.createdAt < cutoff) void deleteSession(id);
    void sweepOrphanShots(env.sessionTtlMinutes * 60_000);
  }, 60_000);
  g.__ksSweeper.unref?.();
}
