// Real screenshot of a live listing: open the page, find the sentence that
// mentions the skill, highlight it with a yellow <mark>, scroll to it and
// capture a ~900x420 region around it.
import type { BrowserContext, Page } from 'playwright-core';
import { newContext } from './browser';

export const SHOT_W = 900;
export const SHOT_H = 420;

/** Close cookie banners / modals and hide fixed overlays so the sentence is visible. */
async function clearPopups(page: Page) {
  await page.keyboard.press('Escape').catch(() => {});
  const buttons = page.locator(
    'button:visible, [role="button"]:visible, a[role="button"]:visible',
  ).filter({ hasText: /^\s*(accept( all)?( cookies)?|i agree|agree|got it|ok(ay)?|close|no,? thanks|dismiss|allow( all)?|continue)\s*$/i });
  const n = Math.min(await buttons.count().catch(() => 0), 3);
  for (let i = 0; i < n; i++) await buttons.nth(i).click({ timeout: 800 }).catch(() => {});
  await page
    .evaluate(() => {
      // Hide fixed/sticky layers (headers, chat widgets, banners, modal backdrops).
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.position === 'sticky') el.style.setProperty('display', 'none', 'important');
      }
      document.documentElement.style.setProperty('overflow', 'auto', 'important');
      document.body.style.setProperty('overflow', 'auto', 'important');
    })
    .catch(() => {});
}

/**
 * In the page: find the element containing `quote`, wrap the quote (or the
 * whole small element) in <mark>, scroll it to the centre and return its box.
 */
async function highlight(page: Page, quote: string) {
  return page.evaluate((q) => {
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
    const target = norm(q);
    const style = document.createElement('style');
    style.textContent =
      'mark.ks-mark{background:#FFE14D !important;color:#111 !important;padding:2px 3px;border-radius:4px;box-shadow:0 0 0 3px #FFE14D;}';
    document.head.appendChild(style);

    // Smallest visible element whose text contains the quote.
    let best: HTMLElement | null = null;
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('p,li,span,div,td,dd,h1,h2,h3,h4,strong,b,em,section,article'))) {
      if (!el.offsetParent && el.tagName !== 'BODY') continue; // hidden
      const t = norm(el.innerText || '');
      if (!t.includes(target)) continue;
      if (!best || t.length < norm(best.innerText).length) best = el;
    }
    if (!best) return null;

    // Try to wrap exactly the quote inside a single text node.
    let mark: HTMLElement | null = null;
    const words = q.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(words.join('\\s+'), 'i');
    const walker = document.createTreeWalker(best, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const m = re.exec(n.textContent || '');
      if (!m) continue;
      const range = document.createRange();
      range.setStart(n, m.index);
      range.setEnd(n, m.index + m[0].length);
      mark = document.createElement('mark');
      mark.className = 'ks-mark';
      try {
        range.surroundContents(mark);
      } catch {
        mark = null;
      }
      break;
    }
    // Otherwise (quote split across tags) mark the whole small element.
    if (!mark) {
      mark = document.createElement('mark');
      mark.className = 'ks-mark';
      while (best.firstChild) mark.appendChild(best.firstChild);
      best.appendChild(mark);
    }
    mark.scrollIntoView({ block: 'center', inline: 'nearest' });
    const r = mark.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, vw: window.innerWidth, vh: window.innerHeight };
  }, quote);
}

/** Capture one proof screenshot. Returns the JPEG bytes, or null on any failure. */
export async function captureProof(url: string, quote: string, timeoutMs: number): Promise<Buffer | null> {
  // If the browser can't launch (e.g. missing binary), return null -> text proof card.
  let ctx: BrowserContext;
  try {
    ctx = await newContext();
  } catch (e) {
    console.warn('[shot] browser unavailable:', String((e as Error)?.message ?? e).split('\n')[0]);
    return null;
  }
  const work = (async () => {
    const page = await ctx.newPage();
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    if (!res || res.status() >= 400) return null;
    await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});
    await clearPopups(page);
    const box = await highlight(page, quote);
    if (!box || box.w === 0 || box.h === 0) return null;
    await page.waitForTimeout(250); // let layout settle after scrolling
    // Re-measure after the scroll and centre the clip on the mark.
    const r = await page.evaluate(() => {
      const m = document.querySelector('mark.ks-mark') as HTMLElement | null;
      const b = m?.getBoundingClientRect();
      return b ? { x: b.left, y: b.top, w: b.width, h: b.height } : null;
    });
    if (!r) return null;
    const x = Math.max(0, Math.min(box.vw - SHOT_W, r.x + r.w / 2 - SHOT_W / 2));
    const y = Math.max(0, Math.min(box.vh - SHOT_H, r.y + r.h / 2 - SHOT_H / 2));
    return page.screenshot({ type: 'jpeg', quality: 82, clip: { x, y, width: SHOT_W, height: SHOT_H } });
  })();
  try {
    // Hard cap per page (SCREENSHOT_TIMEOUT_MS + a little for the capture itself).
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs + 4000));
    return await Promise.race([work, timeout]).catch((e) => {
      console.warn('[shot] failed:', String((e as Error)?.message ?? e).split('\n')[0]);
      return null;
    });
  } finally {
    await ctx.close().catch(() => {});
  }
}
