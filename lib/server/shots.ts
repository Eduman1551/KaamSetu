// Temporary screenshot files. Each file gets a random token; the token is the
// only way to fetch it (via /api/shot/[token]). Files are deleted with the session.
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export const SHOT_DIR = path.join(os.tmpdir(), 'kaamsetu-shots');

interface ShotEntry {
  file: string;
  sessionId: string;
  createdAt: number;
}

const g = globalThis as unknown as { __ksShots?: Map<string, ShotEntry> };
const shots: Map<string, ShotEntry> = g.__ksShots ?? (g.__ksShots = new Map());

/** Reserve a new token + temp file path for a session's screenshot. */
export async function newShotPath(sessionId: string) {
  await fs.mkdir(SHOT_DIR, { recursive: true });
  const token = crypto.randomBytes(18).toString('hex');
  const file = path.join(SHOT_DIR, `${token}.jpg`);
  return { token, file };
}

export function registerShot(token: string, file: string, sessionId: string) {
  shots.set(token, { file, sessionId, createdAt: Date.now() });
}

export function lookupShot(token: string) {
  return shots.get(token);
}

export async function deleteShotsForSession(sessionId: string) {
  const jobs: Promise<unknown>[] = [];
  for (const [token, s] of shots) {
    if (s.sessionId === sessionId) {
      shots.delete(token);
      jobs.push(fs.rm(s.file, { force: true }));
    }
  }
  await Promise.allSettled(jobs);
}

/** Delete any temp screenshot older than maxAgeMs (also catches files left by a crash). */
export async function sweepOrphanShots(maxAgeMs: number) {
  try {
    const names = await fs.readdir(SHOT_DIR);
    const now = Date.now();
    await Promise.allSettled(
      names.map(async (n) => {
        const p = path.join(SHOT_DIR, n);
        const st = await fs.stat(p);
        if (now - st.mtimeMs > maxAgeMs) {
          await fs.rm(p, { force: true });
          shots.delete(n.replace(/\.jpg$/, ''));
        }
      }),
    );
  } catch {
    /* directory may not exist yet */
  }
}
