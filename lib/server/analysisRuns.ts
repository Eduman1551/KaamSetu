// Status of each student's latest analysis run, stored in the DB so the browser can
// recover with a refresh or a 2-second poll if the SSE stream drops (serverless-safe).
import { eq } from 'drizzle-orm';
import { db } from './db';
import { analysisRuns } from './db/schema';
import { MAX_DURATION_SEC } from './env';

export interface RunStatus {
  status: 'running' | 'done' | 'failed';
  error: string | null;
  startedAt: string;
  updatedAt: string;
}

/** A 'running' row older than the function limit (+ margin) can no longer finish. */
export function effectiveStatus(row: { status: RunStatus['status']; updatedAt: Date; error: string | null }, now = Date.now()) {
  if (row.status === 'running' && now - row.updatedAt.getTime() > (MAX_DURATION_SEC + 60) * 1000) {
    return { status: 'failed' as const, error: 'The analysis did not finish in time. Please try again.' };
  }
  return { status: row.status, error: row.error };
}

export async function getRunStatus(studentId: string): Promise<RunStatus | null> {
  const [r] = await db.select().from(analysisRuns).where(eq(analysisRuns.studentId, studentId));
  if (!r) return null;
  const e = effectiveStatus(r);
  return { status: e.status, error: e.error, startedAt: r.startedAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
}

export async function setRun(studentId: string, status: RunStatus['status'], error: string | null = null) {
  const now = new Date();
  const values = { status, error, updatedAt: now, ...(status === 'running' ? { startedAt: now } : {}) };
  await db
    .insert(analysisRuns)
    .values({ studentId, ...values })
    .onConflictDoUpdate({ target: analysisRuns.studentId, set: values });
}

/** Touch the row while a run is alive (keeps it from looking stale). */
export async function heartbeat(studentId: string) {
  await db.update(analysisRuns).set({ updatedAt: new Date() }).where(eq(analysisRuns.studentId, studentId));
}
