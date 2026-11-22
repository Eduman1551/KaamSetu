// One shared headless Chromium (Playwright), stored on globalThis so dev hot
// reloads don't leak browsers. Used to read listing pages and take screenshots.
import { chromium, type Browser, type BrowserContext } from 'playwright';

const g = globalThis as unknown as { __ksBrowser?: Promise<Browser> };

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function getBrowser(): Promise<Browser> {
  if (g.__ksBrowser) {
    const b = await g.__ksBrowser.catch(() => null);
    if (b && b.isConnected()) return b;
  }
  g.__ksBrowser = chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });
  return g.__ksBrowser;
}

export async function newContext(opts: { forScreenshot?: boolean } = {}): Promise<BrowserContext> {
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent: USER_AGENT,
    locale: 'en-IN',
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: opts.forScreenshot ? 1.5 : 1,
    javaScriptEnabled: true,
  });
  // When run through tsx/esbuild (our scripts), functions passed to page.evaluate
  // reference an `__name` helper that doesn't exist in the page. Provide a no-op.
  await ctx.addInitScript({ content: 'window.__name = window.__name || function (f) { return f; };' });
  if (!opts.forScreenshot) {
    // Reading text only: skip images, fonts and media to load faster.
    await ctx.route('**/*', (route) => {
      const t = route.request().resourceType();
      return ['image', 'media', 'font'].includes(t) ? route.abort() : route.continue();
    });
  }
  return ctx;
}

/**
 * Open a URL and return the visible text of the page ('' on failure), plus the
 * final URL after redirects (closed jobs often redirect to the company's job list).
 */
export async function fetchPageText(url: string, timeoutMs = 15_000): Promise<{ text: string; finalUrl: string }> {
  const ctx = await newContext();
  try {
    const page = await ctx.newPage();
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    if (!res || res.status() >= 400) return { text: '', finalUrl: url };
    // Give client-rendered pages a moment to fill in.
    await page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => {});
    const text = await page.evaluate(() => document.body?.innerText || '');
    return { text, finalUrl: page.url() };
  } catch {
    return { text: '', finalUrl: url };
  } finally {
    await ctx.close().catch(() => {});
  }
}
