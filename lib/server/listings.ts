// Step 3: find live job listing URLs (Tavily), open each page (Playwright),
// extract skills with the exact quote (Groq fast model), and verify every
// quote really exists in the page text.
import { z } from 'zod';
import { env } from './env';
import { chatJSON } from './groq';
import { tavilySearch, type TavilyResult } from './tavily';
import { fetchPageText } from './browser';
import { isNoise, skillKey, textMentions } from './skills';

// Job boards whose single-listing pages are public and readable by a headless browser.
const BOARD_DOMAINS = [
  'shine.com', 'hiredoor.in', 'internshala.com', 'cutshort.io', 'instahyre.com', 'hirist.tech',
  'iimjobs.com', 'apna.co', 'unstop.com', 'freshersworld.com', 'timesjobs.com', 'datajobsindia.com',
];
// Public applicant-tracking-system boards used by many companies.
const ATS_DOMAINS = [
  'jobs.lever.co', 'boards.greenhouse.io', 'job-boards.greenhouse.io', 'jobs.ashbyhq.com',
  'apply.workable.com', 'jobs.smartrecruiters.com',
];
// Login-walled, bot-walled or not-a-listing sites we skip.
const BLOCKED = [
  'linkedin.com', 'naukri.com', 'foundit.in', 'monsterindia.com', 'glassdoor.com', 'glassdoor.co.in', 'indeed.com',
  'in.indeed.com', 'ambitionbox.com', 'instagram.com', 'facebook.com', 'reddit.com', 'youtube.com', 't.me',
  'quora.com', 'medium.com', 'scribd.com', 'slideshare.net', 'x.com', 'twitter.com', 'wellfound.com', 'amazon.jobs', 'scaler.com', 'upgrad.com',
];

export interface Evidence {
  skillKeyName: string; // as written by the listing
  quote: string; // verified exact quote
  sentence: string; // full sentence around the quote (from the page text)
}

export interface Listing {
  url: string;
  domain: string;
  title: string;
  company: string;
  skills: Evidence[];
}

export function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Heuristic: does this URL point to ONE job posting (not a search/list page)? */
export function looksLikeSingleListing(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const host = u.hostname.replace(/^www\./, '');
  if (BLOCKED.some((d) => host === d || host.endsWith('.' + d))) return false;
  const path = decodeURIComponent(u.pathname).toLowerCase();
  if (/\/(blog|blogs|news|salary|salaries|search|job-search|roles?|skills|categories|category|explore|resources|career-advice|articles?|courses?)(\/|$)/.test(path)) return false;
  if (/(-jobs|-jobs-in-[a-z-]+|-vacancies|jobs\.html?|\/q-)$/.test(path.replace(/\/$/, ''))) return false;
  if (/jobs-in-|\/latest-jobs|fresher-jobs\//.test(path)) return false;
  if (/\/apply\/?$/.test(path)) return true; // lever "/apply" pages still show the description
  // Positive signals: an id-like token, or a /job/ or /jobs/<slug>/ path.
  const idLike = /\d{5,}|[0-9a-f]{8}-[0-9a-f]{4}|\b(?=[0-9a-f]*\d)[0-9a-f]{6,}\b/.test(path) || /[?&](id|gh_jid|jobid)=/i.test(u.search);
  const jobPath = /\/(job|jobs|j|job-detail|jobdetails|job-listing|opening|openings|careers?)\/[^/]+/.test(path);
  return idLike && (jobPath || ATS_DOMAINS.some((d) => host.endsWith(d)) || path.split('/').filter(Boolean).length >= 2);
}

/** Run several Tavily searches and return de-duplicated candidate listing URLs. */
export async function findListingUrls(roles: string[], want: number): Promise<TavilyResult[]> {
  const queries: { q: string; include?: string[]; exclude?: string[] }[] = [];
  roles.slice(0, 2).forEach((role, i) => {
    // The boards below give the best yield of readable, India-based fresher listings.
    queries.push({ q: `${role} fresher job India`, include: ['internshala.com'] });
    queries.push({ q: `${role} job freshers 0-2 years India`, include: ['hiredoor.in'] });
    queries.push({ q: `${role} job fresher India skills required`, include: ['shine.com', 'cutshort.io', 'instahyre.com'] });
    queries.push({ q: `${role} fresher job Bengaluru Pune Hyderabad Mumbai Delhi 0-1 years`, include: BOARD_DOMAINS });
    queries.push({ q: `${role} fresher job opening India apply job description`, exclude: BLOCKED });
    // Company ATS boards: lower India yield, so only for the main role.
    if (i === 0) queries.push({ q: `${role} India Bengaluru OR Pune OR Hyderabad 0-2 years`, include: ATS_DOMAINS });
  });
  const batches = await Promise.allSettled(
    queries.map((x) => tavilySearch(x.q, { maxResults: 20, includeDomains: x.include, excludeDomains: x.exclude })),
  );
  const ok = batches.filter((b): b is PromiseFulfilledResult<TavilyResult[]> => b.status === 'fulfilled');
  if (ok.length === 0) {
    const first = batches.find((b) => b.status === 'rejected') as PromiseRejectedResult | undefined;
    throw first?.reason instanceof Error ? first.reason : new Error('Web search failed.');
  }

  // De-duplicate and keep only single-listing URLs.
  const seen = new Set<string>();
  const byDomain = new Map<string, TavilyResult[]>();
  for (const r of ok.flatMap((b) => b.value)) {
    const key = r.url.replace(/[?#].*$/, '').replace(/\/apply\/?$/, '').replace(/\/$/, '').replace(/^http:/, 'https:');
    if (seen.has(key) || !looksLikeSingleListing(r.url)) continue;
    seen.add(key);
    const d = domainOf(r.url);
    byDomain.set(d, [...(byDomain.get(d) ?? []), { ...r, url: r.url.replace(/^http:/, 'https:') }]);
  }
  // Round-robin across domains so one site doesn't dominate.
  const out: TavilyResult[] = [];
  const lists = [...byDomain.values()];
  for (let i = 0; out.length < want && lists.some((l) => l.length > i); i++) {
    for (const l of lists) if (l[i] && out.length < want) out.push(l[i]);
  }
  return out;
}

const INDIA_RE =
  /\b(india|bengaluru|bangalore|mumbai|pune|hyderabad|chennai|delhi|gurgaon|gurugram|noida|kolkata|ahmedabad|jaipur|kochi|indore|chandigarh|coimbatore|thane|nagpur|lucknow|bhubaneswar|vadodara|mohali|trivandrum|thiruvananthapuram|mysuru|mysore|visakhapatnam)\b/i;
const GENERIC_TITLE_RE = /(page not found|careers? (at|page)|open positions|current openings|positions archive|jobs in |job search|search jobs|^careers\b)/i;
const ROLE_SYNONYMS: Record<string, string[]> = {
  developer: ['developer', 'engineer', 'programmer', 'sde'],
  engineer: ['engineer', 'developer', 'sde'],
  analyst: ['analyst', 'analytics', 'analysis'],
  scientist: ['scientist', 'science'],
  designer: ['designer', 'design'],
  manager: ['manager', 'management'],
};

/** Words that must appear in a relevant listing, e.g. "Data Analyst" -> analyst/analytics/analysis. */
export function roleWords(roles: string[]): string[] {
  const words = new Set<string>();
  for (const r of roles) {
    const last = r.toLowerCase().replace(/[^a-z ]/g, ' ').trim().split(/\s+/).pop() || '';
    for (const w of ROLE_SYNONYMS[last] ?? [last]) words.add(w);
  }
  return [...words].filter(Boolean);
}

/**
 * Cheap checks done in code BEFORE spending AI tokens on a page.
 * Returns a reason to skip, or null if the page is worth analysing.
 */
export function preCheck(text: string, title: string, words: string[]): string | null {
  if (text.length < 400) return 'unreadable';
  const head = text.slice(0, 1500);
  if (/access denied|verify you are human|captcha|enable javascript and cookies|page not found|no longer accepting|job (is )?(closed|expired)/i.test(head)) return 'blocked or closed';
  if (GENERIC_TITLE_RE.test(title)) return 'not a single listing';
  if (!INDIA_RE.test(text)) return 'not in India';
  const hay = (title + ' ' + head).toLowerCase();
  if (words.length && !words.some((w) => hay.includes(w))) return 'different role';
  // Clearly senior: "3+ years of experience", "5-8 years experience", ...
  const exp = /(\d{1,2})\s*\+?\s*(?:(?:-|to|–)\s*\d{1,2}\s*)?(?:years?|yrs)\s*(?:of\s*)?(?:relevant\s*|professional\s*|work\s*)?(?:experience|exp)/i.exec(text);
  if (exp && Number(exp[1]) >= 3) return 'not entry level';
  return null;
}

/** Keep the part of the page most likely to hold the job requirements. */
function cropListing(text: string, max = 2200): string {
  const clean = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0)
    .join('\n');
  const m = /(job description|responsibilit|requirement|qualification|skills|what you|about the role|role overview|eligibility|who you are|must have|key skills)/i.exec(clean);
  const start = m ? Math.max(0, m.index - 400) : 0;
  return clean.slice(start, start + max);
}

const ExtractSchema = z.object({
  isListing: z.boolean().catch(false),
  inIndia: z.boolean().catch(true),
  entryLevel: z.boolean().catch(true),
  title: z.string().catch(''),
  company: z.string().catch(''),
  skills: z
    .array(z.object({ name: z.string(), quote: z.string() }))
    .catch([])
    .transform((a) => a.slice(0, 10)),
});

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Verify that `quote` exists in the page text (ignoring case and whitespace).
 * Returns the full sentence around it, or null if the quote is not really there.
 */
export function verifyQuote(pageText: string, quote: string): { quote: string; sentence: string } | null {
  const words = quote
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (words.length < 2) return null;
  const re = new RegExp(words.map(escapeRe).join('\\s+'), 'i');
  const normalised = pageText.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  const m = re.exec(normalised);
  if (!m) return null;
  // Expand to sentence / bullet boundaries.
  const before = normalised.slice(0, m.index);
  const after = normalised.slice(m.index + m[0].length);
  const lastNl = before.lastIndexOf('\n');
  const lastStop = Math.max(before.lastIndexOf('. '), before.lastIndexOf('! '), before.lastIndexOf('? '));
  const leftCut = Math.max(lastNl, lastStop >= 0 ? lastStop + 1 : -1);
  const rightMatch = /[.!?](\s|$)|\n/.exec(after);
  const left = before.slice(leftCut + 1);
  const right = rightMatch ? after.slice(0, rightMatch.index + (after[rightMatch.index] === '\n' ? 0 : 1)) : after.slice(0, 200);
  let sentence = (left + m[0] + right).replace(/\s+/g, ' ').replace(/^[•\-–*·\s]+/, '').trim();
  if (sentence.length > 260) sentence = m[0].replace(/\s+/g, ' ').trim();
  return { quote: m[0].replace(/\s+/g, ' ').trim(), sentence };
}

/** Open one listing and extract verified skills. Returns null if it isn't usable. */
export async function analyseListing(
  candidate: TavilyResult,
  words: string[],
  onWait?: (s: number) => void,
): Promise<{ listing: Listing | null; reason: string; dropped: number }> {
  const text = await fetchPageText(candidate.url, 10_000);
  const skip = preCheck(text, candidate.title, words);
  if (skip) return { listing: null, reason: skip, dropped: 0 };

  // Kept short on purpose: the free Groq tier allows ~8k tokens/minute per model.
  const data = await chatJSON({
    model: env.modelFast,
    schema: ExtractSchema,
    maxTokens: 550,
    onWait,
    system: 'You extract data from job listing pages. Reply with JSON only.',
    user: `Page text:
"""
${cropListing(text)}
"""
JSON: {"isListing":bool,"inIndia":bool,"entryLevel":bool,"title":"","company":"","skills":[{"name":"","quote":""}]}
isListing: ONE specific job posting (not a job list/article). inIndia: in India or remote-India. entryLevel: fresher or 0-2 yrs (true if not stated).
skills: max 10 skills/tools/soft skills the job asks for, short names ("SQL","Power BI"). No degrees or years.
quote: 3-12 words copied EXACTLY from the text where the skill appears.`,
  });

  if (!data.isListing) return { listing: null, reason: 'not a single listing', dropped: 0 };
  if (!data.inIndia) return { listing: null, reason: 'not in India', dropped: 0 };
  if (!data.entryLevel) return { listing: null, reason: 'not entry level', dropped: 0 };

  // Verify every quote against the real page text; drop the ones that aren't there.
  const skills: Evidence[] = [];
  let dropped = 0;
  for (const s of data.skills) {
    const v = verifyQuote(text, s.quote);
    const key = skillKey(s.name);
    const firstWord = s.name.toLowerCase().split(/[\s/]/)[0];
    // Keep it only if the quote exists AND its sentence really mentions the skill.
    if (!v || isNoise(key) || !(textMentions(v.sentence, key) || v.sentence.toLowerCase().includes(firstWord))) {
      dropped++;
      continue;
    }
    skills.push({ skillKeyName: s.name.trim(), quote: v.quote, sentence: v.sentence });
  }
  if (skills.length === 0) return { listing: null, reason: 'no verified skills', dropped };

  return {
    listing: {
      url: candidate.url,
      domain: domainOf(candidate.url),
      title: data.title.trim() || candidate.title.split(/[|–-]/)[0].trim(),
      company: data.company.trim() || domainOf(candidate.url),
      skills,
    },
    reason: 'ok',
    dropped,
  };
}
