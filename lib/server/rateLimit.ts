// Small in-memory sliding-window rate limiter (globalThis so it survives dev reloads).
// Fine for a single local server; a multi-instance deploy would need Redis or the DB.
const g = globalThis as unknown as { __ksRate?: Map<string, number[]> };
const hits: Map<string, number[]> = g.__ksRate ?? (g.__ksRate = new Map());

/** Is `key` under `limit` events in the last `windowMs`? (Does not record.) */
export function isLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.set(key, list);
  return list.length >= limit;
}

export function record(key: string) {
  hits.set(key, [...(hits.get(key) ?? []), Date.now()]);
}

export function reset(key: string) {
  hits.delete(key);
}

export const LOGIN_LIMIT = { max: 5, windowMs: 15 * 60_000 };
