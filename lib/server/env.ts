// Server-only configuration read from .env.local (never sent to the browser).
// Values are never logged.

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export const env = {
  groqKey: process.env.GROQ_API_KEY || '',
  tavilyKey: process.env.TAVILY_API_KEY || '',
  modelMain: process.env.GROQ_MODEL_MAIN || 'llama-3.3-70b-versatile',
  modelFast: process.env.GROQ_MODEL_FAST || 'llama-3.1-8b-instant',
  /** Listings per analysis. Default 12 on Vercel so a run fits the 300 s function limit. */
  maxListings: num('MAX_LISTINGS', process.env.VERCEL ? 12 : 20),
  screenshotTimeoutMs: num('SCREENSHOT_TIMEOUT_MS', 10000),
  /** Include seeded sample students in company/college views (default true). */
  showSynthetic: process.env.SHOW_SYNTHETIC !== 'false',
};

/** Function time limit used by /api/analyze and /api/test/prepare (Vercel Hobby max = 300 s). */
export const MAX_DURATION_SEC = 300;
/** Time the analysis pipeline may use, leaving headroom to save the result. */
export const ANALYSIS_BUDGET_MS = (MAX_DURATION_SEC - 45) * 1000;

/** Throws a friendly error if a required key is missing. */
export function requireKeys() {
  const missing = [!env.groqKey && 'GROQ_API_KEY', !env.tavilyKey && 'TAVILY_API_KEY'].filter(Boolean);
  if (missing.length) throw new Error(`Server is missing ${missing.join(' and ')} in .env.local.`);
}
