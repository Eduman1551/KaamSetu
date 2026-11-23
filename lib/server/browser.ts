// Headless Chromium for the 3 proof screenshots ONLY (listing text uses plain HTTP).
//  - On Vercel (process.env.VERCEL): playwright-core + @sparticuz/chromium (Linux binary
//    shipped with the function; Playwright's own browsers can't run there).
//  - Locally: the normal Playwright Chromium (`pnpm exec playwright install chromium`).
// Both are imported lazily, so a missing/broken browser never affects the rest of the app.
import type { Browser, BrowserContext } from 'playwright-core';

export type Launcher = 'sparticuz' | 'playwright';

/** Pure helper (unit-tested): which browser to use for this environment. */
export function pickLauncher(env: Record<string, string | undefined> = process.env): Launcher {
  return env.VERCEL ? 'sparticuz' : 'playwright';
}

async function launch(): Promise<Browser> {
  if (pickLauncher() === 'sparticuz') {
    const [{ default: chromium }, { chromium: pw }] = await Promise.all([import('@sparticuz/chromium'), import('playwright-core')]);
    return pw.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  }
  const { chromium } = await import('playwright');
  return chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'] });
}

// Reused within one warm server instance (an optimisation only; nothing depends on it).
const g = globalThis as unknown as { __ksBrowser?: Promise<Browser> };

export async function getBrowser(): Promise<Browser> {
  if (g.__ksBrowser) {
    const b = await g.__ksBrowser.catch(() => null);
    if (b && b.isConnected()) return b;
  }
  g.__ksBrowser = launch();
  g.__ksBrowser.catch(() => {
    g.__ksBrowser = undefined; // allow a retry next time
  });
  return g.__ksBrowser;
}

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function newContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
  const ctx = await browser.newContext({ userAgent: USER_AGENT, locale: 'en-IN', viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.5 });
  // When run through tsx/esbuild (our scripts), functions passed to page.evaluate
  // reference an `__name` helper that doesn't exist in the page. Provide a no-op.
  await ctx.addInitScript({ content: 'window.__name = window.__name || function (f) { return f; };' });
  return ctx;
}

/** Close the shared browser (scripts only). */
export async function closeBrowser() {
  const b = await g.__ksBrowser?.catch(() => null);
  await b?.close().catch(() => {});
  g.__ksBrowser = undefined;
}
