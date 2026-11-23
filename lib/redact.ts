// Deterministic scrub that runs AFTER the AI writes anonymous highlight bullets.
// Any bullet that still contains contact details or identifying words is dropped.

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/i;
const PHONE = /(\+?\d[\d\s().-]{8,}\d)/;
const URL_RE = /\b(https?:\/\/|www\.)\S+|\b[\w-]+\.(com|in|org|net|io|dev|ai|co|me|app|edu|ac\.in|github\.io)\b(\/\S*)?/i;
const HANDLE = /(^|[\s(])@[A-Za-z0-9_.]{2,}/;
const SOCIAL = /\b(github|gitlab|linkedin|twitter|instagram|leetcode|hackerrank|kaggle\.com|behance|dribbble)\b\s*[:/]/i;

// Generic words in college names that are not identifying on their own.
const GENERIC = new Set(['institute', 'institution', 'technology', 'college', 'university', 'engineering', 'school', 'science', 'sciences', 'management', 'national', 'indian', 'state', 'government', 'academy', 'polytechnic', 'studies', 'education', 'research', 'center', 'centre']);

export interface Identity {
  name?: string | null;
  email?: string | null;
  collegeName?: string | null;
}

function words(s: string, min: number) {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= min);
}

/** Terms that must never appear in a highlight for this student. */
export function forbiddenTerms(id: Identity): string[] {
  const t = new Set<string>();
  if (id.name) words(id.name, 3).forEach((w) => t.add(w));
  if (id.email) {
    const prefix = id.email.toLowerCase().split('@')[0];
    if (prefix.length >= 3) t.add(prefix);
    words(prefix, 4).forEach((w) => t.add(w));
  }
  if (id.collegeName) {
    t.add(id.collegeName.toLowerCase().trim());
    words(id.collegeName, 4)
      .filter((w) => !GENERIC.has(w))
      .forEach((w) => t.add(w));
  }
  return [...t];
}

export function containsPII(bullet: string, id: Identity): boolean {
  if (EMAIL.test(bullet) || PHONE.test(bullet) || URL_RE.test(bullet) || HANDLE.test(bullet) || SOCIAL.test(bullet)) return true;
  const lower = ` ${bullet.toLowerCase()} `;
  return forbiddenTerms(id).some((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(lower);
  });
}

/** Keep at most 5 short, clean bullets. */
export function scrubHighlights(bullets: string[], id: Identity): string[] {
  return bullets
    .map((b) => b.replace(/\s+/g, ' ').replace(/^[-•*\s]+/, '').trim())
    .filter((b) => b.length >= 8 && b.length <= 160)
    .filter((b) => !containsPII(b, id))
    .slice(0, 5);
}
