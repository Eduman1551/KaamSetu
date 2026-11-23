// Fixed-window rate limiter stored in Postgres (`rate_limits`), so limits hold
// across serverless instances and restarts. One row per key.
import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { rateLimits } from './db/schema';

/** Pure helper (unit-tested): is a stored window still active and full? */
export function windowFull(row: { windowStart: Date; count: number } | undefined, limit: number, windowMs: number, now = Date.now()) {
  if (!row) return false;
  if (now - row.windowStart.getTime() >= windowMs) return false; // window expired
  return row.count >= limit;
}

/** Is `key` at or over `limit` events in the current window? (Does not record.) */
export async function isLimited(key: string, limit: number, windowMs: number) {
  const [row] = await db.select().from(rateLimits).where(eq(rateLimits.key, key));
  return windowFull(row, limit, windowMs);
}

/** Count one event; starts a new window when the previous one has expired. */
export async function record(key: string, windowMs: number) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);
  await db
    .insert(rateLimits)
    .values({ key, windowStart: now, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.windowStart} < ${cutoff.toISOString()}::timestamptz then 1 else ${rateLimits.count} + 1 end`,
        windowStart: sql`case when ${rateLimits.windowStart} < ${cutoff.toISOString()}::timestamptz then ${now.toISOString()}::timestamptz else ${rateLimits.windowStart} end`,
      },
    });
}

export async function reset(key: string) {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}

/** Check + record in one call. Returns false when the limit is already reached. */
export async function take(key: string, limit: number, windowMs: number) {
  if (await isLimited(key, limit, windowMs)) return false;
  await record(key, windowMs);
  return true;
}

export const LOGIN_LIMIT = { max: 5, windowMs: 15 * 60_000 };
