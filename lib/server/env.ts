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
  maxListings: num('MAX_LISTINGS', 20),
  screenshotTimeoutMs: num('SCREENSHOT_TIMEOUT_MS', 10000),
};

/** Throws a friendly error if a required key is missing. */
export function requireKeys() {
  const missing = [!env.groqKey && 'GROQ_API_KEY', !env.tavilyKey && 'TAVILY_API_KEY'].filter(Boolean);
  if (missing.length) throw new Error(`Server is missing ${missing.join(' and ')} in .env.local.`);
}
