// Serverless readiness: launcher choice, HTML-to-text, DB rate-limit window,
// stale run detection, and the screenshot -> text-card fallback.
import { describe, expect, it, vi } from 'vitest';

// Modules below import the DB client; a dummy URL is enough (no query is made).
vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://user:pass@example-pooler.neon.tech/db';
});

const capture = vi.fn();
vi.mock('@/lib/server/screenshot', () => ({ captureProof: (...a: unknown[]) => capture(...a) }));

import { pickLauncher } from '@/lib/server/browser';
import { decodeEntities, htmlToText, jobPostingText } from '@/lib/server/pageText';
import { windowFull } from '@/lib/server/rateLimit';
import { effectiveStatus } from '@/lib/server/analysisRuns';
import { buildProofCards, type ProofCandidate } from '@/lib/server/proof';

describe('browser launcher selection', () => {
  it('uses @sparticuz/chromium + playwright-core on Vercel', () => {
    expect(pickLauncher({ VERCEL: '1' })).toBe('sparticuz');
  });
  it('uses the local Playwright Chromium everywhere else', () => {
    expect(pickLauncher({})).toBe('playwright');
    expect(pickLauncher({ VERCEL: '' })).toBe('playwright');
  });
});

describe('HTML to text', () => {
  it('keeps block structure and drops scripts/styles', () => {
    const html = `<html><head><title>x</title><style>.a{}</style></head><body>
      <h2>Requirements</h2><ul><li>Strong <b>SQL</b> skills</li><li>Power&nbsp;BI &amp; Excel</li></ul>
      <script>var secret = 1</script><p>Apply&#8203; now</p></body></html>`;
    const t = htmlToText(html);
    expect(t).toContain('Requirements');
    expect(t).toContain('• Strong SQL skills');
    expect(t).toContain('• Power BI & Excel');
    expect(t).not.toContain('secret');
    expect(t).not.toContain('.a{}');
  });
  it('decodes entities', () => {
    expect(decodeEntities('&lt;b&gt; &#x20B9;5 &rsquo;')).toBe('<b> ₹5 ’');
  });
  it('reads the JobPosting description from JSON-LD', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'JobPosting',
      title: 'Junior Data Analyst',
      description: '<p>Write <strong>SQL</strong> queries.</p><ul><li>Excel</li></ul>',
    })}</script>`;
    const t = jobPostingText(html);
    expect(t).toContain('Junior Data Analyst');
    expect(t).toContain('Write SQL queries.');
    expect(t).toContain('• Excel');
  });
});

describe('DB rate-limit window', () => {
  const now = Date.parse('2026-11-23T12:00:00Z');
  it('is full only inside the window at the limit', () => {
    expect(windowFull(undefined, 5, 60_000, now)).toBe(false);
    expect(windowFull({ windowStart: new Date(now - 10_000), count: 5 }, 5, 60_000, now)).toBe(true);
    expect(windowFull({ windowStart: new Date(now - 10_000), count: 4 }, 5, 60_000, now)).toBe(false);
    expect(windowFull({ windowStart: new Date(now - 61_000), count: 99 }, 5, 60_000, now)).toBe(false); // expired
  });
});

describe('analysis run status', () => {
  const now = Date.parse('2026-11-23T12:00:00Z');
  it('treats a running row older than the function limit as failed', () => {
    expect(effectiveStatus({ status: 'running', updatedAt: new Date(now - 30_000), error: null }, now).status).toBe('running');
    const stale = effectiveStatus({ status: 'running', updatedAt: new Date(now - 400_000), error: null }, now);
    expect(stale.status).toBe('failed');
    expect(stale.error).toMatch(/did not finish/);
    expect(effectiveStatus({ status: 'done', updatedAt: new Date(now - 9e9), error: null }, now).status).toBe('done');
  });
});

describe('proof cards fall back to text when screenshots fail', () => {
  const cand = (skill: string, missing: boolean, n: number): ProofCandidate => ({
    skill,
    count: n,
    missing,
    priority: n,
    evidence: [1, 2, 3].map((i) => ({ url: `https://jobs.example/${skill}/${i}`, company: `Co${i}`, jobTitle: 'Analyst', quote: `${skill} required`, sentence: `Strong ${skill} required.` })),
  });
  const cands = [cand('SQL', true, 9), cand('Power BI', true, 8), cand('Excel', false, 7)];

  it('browser launch failure (throws) -> 3 text cards, no crash', async () => {
    capture.mockReset().mockRejectedValue(new Error('Failed to launch chromium'));
    const { cards, shots } = await buildProofCards(cands, 12, () => false);
    expect(cards).toHaveLength(3);
    expect(shots.every((s) => s === null)).toBe(true);
    expect(cards.every((c) => c.shotUrl === null && c.sentence.startsWith('Strong'))).toBe(true);
  });

  it('blocked page -> tries the next listing for that skill', async () => {
    capture.mockReset().mockImplementation(async (url: string) => (url.endsWith('/1') ? null : Buffer.from('jpg')));
    const { cards, shots } = await buildProofCards(cands, 12, () => false);
    expect(shots.filter(Boolean)).toHaveLength(3);
    expect(cards.every((c) => !c.url.endsWith('/1'))).toBe(true);
  });

  it('no time left -> skips screenshots entirely', async () => {
    capture.mockReset().mockResolvedValue(Buffer.from('jpg'));
    const { shots } = await buildProofCards(cands, 12, () => false, Date.now() + 1000);
    expect(capture).not.toHaveBeenCalled();
    expect(shots.every((s) => s === null)).toBe(true);
  });
});
