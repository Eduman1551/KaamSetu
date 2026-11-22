// Find 2 real courses per missing skill with Tavily. URLs come only from search
// results (never guessed). Free/paid and hours are read from the result text.
import type { Course } from '@/lib/types';
import { tavilySearch, type TavilyResult } from './tavily';

const COURSE_SITES: { domain: string; platform: string; free: boolean | 'check'; path?: RegExp }[] = [
  { domain: 'freecodecamp.org', platform: 'freeCodeCamp', free: true, path: /\/learn\// },
  { domain: 'kaggle.com', platform: 'Kaggle Learn', free: true, path: /\/learn\// },
  { domain: 'learn.microsoft.com', platform: 'Microsoft Learn', free: true, path: /\/training\// },
  { domain: 'onlinecourses.nptel.ac.in', platform: 'NPTEL', free: true },
  { domain: 'nptel.ac.in', platform: 'NPTEL', free: true, path: /\/courses?\// },
  { domain: 'onlinecourses.swayam2.ac.in', platform: 'SWAYAM', free: true },
  { domain: 'swayam.gov.in', platform: 'SWAYAM', free: true },
  { domain: 'khanacademy.org', platform: 'Khan Academy', free: true },
  { domain: 'mygreatlearning.com', platform: 'Great Learning', free: true, path: /\/academy\// },
  { domain: 'simplilearn.com', platform: 'Simplilearn SkillUp', free: true, path: /free|skillup/ },
  { domain: 'cognitiveclass.ai', platform: 'Cognitive Class', free: true, path: /\/courses\// },
  { domain: 'w3schools.com', platform: 'W3Schools', free: true },
  { domain: 'coursera.org', platform: 'Coursera', free: 'check', path: /\/(learn|specializations|professional-certificates)\// },
  { domain: 'edx.org', platform: 'edX', free: 'check', path: /\/course\// },
  { domain: 'udemy.com', platform: 'Udemy', free: 'check', path: /\/course\// },
  { domain: 'datacamp.com', platform: 'DataCamp', free: 'check', path: /\/courses\// },
  { domain: 'codecademy.com', platform: 'Codecademy', free: 'check', path: /\/learn\// },
];

function siteFor(url: string) {
  let host = '';
  let path = '';
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./, '');
    path = u.pathname.toLowerCase();
  } catch {
    return null;
  }
  const site = COURSE_SITES.find((s) => host === s.domain || host.endsWith('.' + s.domain));
  if (!site) return null;
  if (site.path && !site.path.test(path + new URL(url).search)) return null;
  // Review / FAQ / pricing sub-pages are not the course itself.
  if (/\/(reviews?|faq|pricing|enterprise)(\/|$)/.test(path)) return null;
  return site;
}

/** Hours, only if the page snippet states them. */
function readHours(text: string): number | null {
  const m = /(\d{1,3}(?:\.\d)?)\s*(?:\+\s*)?(?:total\s+)?(hours|hour|hrs|hr)\b/i.exec(text);
  if (m) {
    const h = Number(m[1]);
    return h > 0 && h < 400 ? Math.round(h * 10) / 10 : null;
  }
  const w = /(\d{1,2})\s*weeks?\b[^.]{0,40}?(\d{1,2})\s*(hours|hrs)\s*(a|per)\s*week/i.exec(text);
  if (w) return Number(w[1]) * Number(w[2]);
  return null;
}

function cleanTitle(t: string, platform: string) {
  return t
    .replace(/\s*[|\-–]\s*(Coursera|Udemy|edX|Kaggle|freeCodeCamp|Microsoft Learn|NPTEL|SWAYAM|Great Learning|Simplilearn|DataCamp|Codecademy|W3Schools|Khan Academy).*$/i, '')
    .replace(new RegExp(`\\s*[|\\-–]\\s*${platform}.*$`, 'i'), '')
    .trim()
    .slice(0, 110);
}

function toCourse(r: TavilyResult, skill: string): Course | null {
  const site = siteFor(r.url);
  if (!site) return null;
  const text = `${r.title} ${r.content}`;
  // The course must actually be about the skill.
  if (!text.toLowerCase().includes(skill.toLowerCase().split(' ')[0])) return null;
  // Platforms that mix free and paid: free only when the course itself says so.
  const free =
    site.free === true ? true : /\bfree\b/i.test(r.title) || /free to audit|audit (this course )?for free|free course/i.test(r.content);
  return { title: cleanTitle(r.title, site.platform) || `${skill} course`, platform: site.platform, url: r.url, free, hours: readHours(text) };
}

/** Two courses for one skill, free ones first. */
export async function findCourses(skill: string): Promise<Course[]> {
  const results = await tavilySearch(`${skill} course for beginners free online`, {
    maxResults: 12,
    includeDomains: COURSE_SITES.map((s) => s.domain),
  }).catch(() => [] as TavilyResult[]);
  const courses = results
    .map((r) => toCourse(r, skill))
    .filter((c): c is Course => !!c);
  // Prefer free, keep Tavily's relevance order otherwise; max one per platform.
  const ordered = [...courses.filter((c) => c.free), ...courses.filter((c) => !c.free)];
  const out: Course[] = [];
  for (const c of ordered) {
    if (out.some((o) => o.platform === c.platform || o.url === c.url)) continue;
    out.push(c);
    if (out.length === 2) break;
  }
  return out;
}
