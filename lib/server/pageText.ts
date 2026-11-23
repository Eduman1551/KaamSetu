// Read job listing pages with a plain HTTP fetch + HTML-to-text (no browser needed).
// The browser is only used for the 3 proof screenshots, so a browser failure can
// never break an analysis.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', bull: '•', hellip: '…', middot: '·', rupee: '₹' };

export function decodeEntities(s: string) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Job description text from schema.org JobPosting JSON-LD, if the page has it. */
export function jobPostingText(html: string): string {
  const out: string[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1].trim());
      const items = (Array.isArray(data) ? data : data['@graph'] ?? [data]) as Record<string, unknown>[];
      for (const it of items) {
        if (String(it?.['@type'] ?? '').toLowerCase() !== 'jobposting') continue;
        const parts = [it.title, it.description, it.qualifications, it.skills, it.responsibilities, it.experienceRequirements]
          .map((p) => (typeof p === 'string' ? p : Array.isArray(p) ? p.join(', ') : ''))
          .filter(Boolean);
        out.push(...parts.map((p) => htmlToText(String(p))));
      }
    } catch {
      /* invalid JSON-LD: ignore */
    }
  }
  return out.join('\n');
}

/** Convert HTML to readable text with line breaks at block boundaries. */
export function htmlToText(html: string): string {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|section|article|header|footer|blockquote|dd|dt|table|nav|aside|main|form)>/gi, '\n')
    .replace(/<(p|div|h[1-6]|tr|section|article|table|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  return s
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .filter((l) => l && l !== '•')
    .join('\n');
}

/** Fetch a listing page and return its visible text ('' on failure) and final URL. */
export async function fetchListingText(url: string, timeoutMs = 10_000): Promise<{ text: string; finalUrl: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-IN,en;q=0.9' },
    });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.includes('html')) return { text: '', finalUrl: res.url || url };
    const html = (await res.text()).slice(0, 2_000_000);
    const fromLd = jobPostingText(html);
    const body = htmlToText(html);
    // Structured description first (cleanest), then the page body for context.
    return { text: fromLd ? `${fromLd}\n${body}` : body, finalUrl: res.url || url };
  } catch {
    return { text: '', finalUrl: url };
  } finally {
    clearTimeout(timer);
  }
}
