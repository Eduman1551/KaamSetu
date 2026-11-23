// Groq helper: JSON-mode chat completion validated with zod.
// - Exponential backoff on 429 rate-limit errors (respects retry-after).
// - If the configured model is not available on this Groq account, or is
//   rate-limited, it falls back to another available chat model.
import Groq from 'groq-sdk';
import type { z } from 'zod';
import { env } from './env';

let client: Groq | null = null;
function groq() {
  // maxRetries: 0 because we do our own retry logic below.
  if (!client) client = new Groq({ apiKey: env.groqKey, maxRetries: 0, timeout: 60_000 });
  return client;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Chat models that support JSON mode, in order of preference for fallback.
const PREFERRED = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'llama-3.3-70b-versatile',
  'qwen/qwen3.8-27b',
  'qwen/qwen3-32b',
  'llama-3.1-8b-instant',
];

const g = globalThis as unknown as {
  __ksModels?: Promise<string[]>;
  __ksBlocked?: Map<string, number>;
  __ksWarned?: Set<string>;
};
// model id -> timestamp until which it is rate-limited
const blockedUntil: Map<string, number> = g.__ksBlocked ?? (g.__ksBlocked = new Map());
const warned: Set<string> = g.__ksWarned ?? (g.__ksWarned = new Set());

/** Chat models this API key can use (cached for the server's lifetime). */
function availableModels(): Promise<string[]> {
  if (!g.__ksModels) {
    g.__ksModels = groq()
      .models.list()
      .then((r) => r.data.map((m) => m.id).filter((id) => !/whisper|guard|orpheus|tts|allam/i.test(id)))
      .catch(() => {
        g.__ksModels = undefined; // retry next time
        return [] as string[];
      });
  }
  return g.__ksModels;
}

/**
 * Ordered list of models to try: the requested one first (if available),
 * then the other available models as rate-limit fallbacks.
 */
async function modelPool(requested: string): Promise<string[]> {
  const avail = await availableModels();
  if (avail.length === 0) return [requested]; // couldn't list: just try it
  const pool: string[] = [];
  if (avail.includes(requested)) pool.push(requested);
  else if (!warned.has(requested)) {
    warned.add(requested);
    console.warn(`[groq] model "${requested}" is not available on this account; using a fallback model.`);
  }
  for (const m of PREFERRED) if (avail.includes(m) && !pool.includes(m)) pool.push(m);
  return pool.length ? pool : [requested];
}

/** Per-model extra parameters (reasoning models think less = faster, fewer tokens). */
function extraParams(model: string): Record<string, unknown> {
  if (model.includes('gpt-oss')) return { reasoning_effort: 'low' };
  return {};
}

function retryAfterMs(headers: unknown): number | null {
  if (!headers) return null;
  const h = headers as { get?: (k: string) => string | null } & Record<string, string>;
  const v = typeof h.get === 'function' ? h.get('retry-after') : h['retry-after'];
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n * 1000 : null;
}

interface Opts<T extends z.ZodTypeAny> {
  model: string;
  system: string;
  user: string;
  schema: T;
  maxTokens?: number;
  /** Called when we have to wait for the rate limit (to update the UI). */
  onWait?: (seconds: number) => void;
}

/** Ask Groq for JSON and return it parsed + validated. */
export async function chatJSON<T extends z.ZodTypeAny>(o: Opts<T>): Promise<z.infer<T>> {
  const pool = await modelPool(o.model);
  const maxAttempts = 8;
  let badAnswers = 0;
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Pick the first model in the pool that is not currently rate-limited.
    const now = Date.now();
    let model = pool.find((m) => (blockedUntil.get(m) ?? 0) <= now);
    if (!model) {
      // Everything is rate-limited: wait (exponential backoff, at least until the first unblocks).
      const soonest = Math.min(...pool.map((m) => blockedUntil.get(m) ?? now));
      const wait = Math.max(soonest - now, Math.min(20_000, 1000 * 2 ** attempt)) + Math.random() * 300;
      o.onWait?.(Math.ceil(wait / 1000));
      await sleep(wait);
      model = pool[0];
    }

    try {
      const res = await groq().chat.completions.create({
        model,
        temperature: 0.1,
        // reasoning models count their thinking tokens here, so leave headroom
        max_tokens: (o.maxTokens ?? 1024) + (model.includes('gpt-oss') ? 600 : 0),
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: o.system },
          { role: 'user', content: o.user },
        ],
        ...extraParams(model),
      } as Parameters<ReturnType<typeof groq>['chat']['completions']['create']>[0]);
      const text = (res as Groq.Chat.ChatCompletion).choices[0]?.message?.content ?? '{}';
      const parsed = o.schema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
      lastErr = new Error('AI returned JSON in an unexpected shape');
    } catch (err: unknown) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      if (status === 429) {
        // Mark this model as busy, then immediately try the next one in the pool.
        const ra = retryAfterMs((err as { headers?: unknown }).headers);
        blockedUntil.set(model, Date.now() + (ra ?? Math.min(30_000, 1000 * 2 ** attempt)));
        continue;
      }
      if (status === 404 || (status === 400 && /model/i.test(String((err as Error).message)))) {
        // Model missing/decommissioned: drop it from the pool for this call.
        pool.splice(pool.indexOf(model), 1);
        if (pool.length === 0) break;
        continue;
      }
      if (status && status >= 500) {
        await sleep(Math.min(8000, 1000 * 2 ** attempt));
        continue;
      }
      if (!(err instanceof SyntaxError) && status !== 400) break; // other errors: give up
    }
    // Malformed / invalid JSON (or json_validate_failed): retry, moving to the next
    // model in the pool each time; give up after 3 bad answers.
    if (++badAnswers > 2) break;
    if (pool.length > 1) pool.push(pool.splice(pool.indexOf(model), 1)[0]);
  }
  throw lastErr instanceof Error ? lastErr : new Error('AI request failed');
}
