// Resume helpers: PDF text extraction (in memory) and basic ATS checks done in code.
// pdf-parse's index.js runs a self-test on import, so we import the inner module.
// @ts-expect-error - the inner path has no type declarations
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import type { AtsTip } from '@/lib/types';

export interface ParsedResume {
  text: string;
  pages: number;
}

export async function extractPdfText(buf: Buffer): Promise<ParsedResume> {
  const parse = pdfParse as (b: Buffer) => Promise<{ text: string; numpages: number }>;
  const data = await parse(buf);
  const text = (data.text || '')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  return { text, pages: data.numpages || 1 };
}

export interface AtsCheck {
  tips: AtsTip[];
  /** 0-100 readability score computed from the checks. */
  score: number;
  sectionsFound: string[];
}

const SECTIONS: { name: string; re: RegExp }[] = [
  { name: 'Education', re: /\b(education|academic|qualification)/i },
  { name: 'Skills', re: /\b(skills|technical skills|tech stack|technologies)\b/i },
  { name: 'Projects', re: /\bprojects?\b/i },
  { name: 'Experience', re: /\b(experience|internships?|work history|employment)\b/i },
];

/** Simple, explainable ATS checks done in code (no AI). */
export function atsChecks(text: string, pages: number): AtsCheck {
  const tips: AtsTip[] = [];
  let score = 100;

  const email = /[\w.+-]+@[\w-]+\.[\w.]+/.test(text);
  const phone = /(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/.test(text) || /\+?\d[\d\s-]{9,14}\d/.test(text);
  if (email && phone) {
    tips.push({ pass: true, text: 'Email and phone number are easy to find.' });
  } else {
    score -= 20;
    const what = !email && !phone ? 'email and phone number' : !email ? 'email address' : 'phone number';
    tips.push({ pass: false, text: `Add your ${what} at the top.` });
  }

  const found = SECTIONS.filter((s) => s.re.test(text)).map((s) => s.name);
  const missing = SECTIONS.filter((s) => !found.includes(s.name)).map((s) => s.name);
  if (missing.length === 0) {
    tips.push({ pass: true, text: 'All key sections found: Education, Skills, Projects, Experience.' });
  } else {
    score -= 10 * missing.length;
    tips.push({ pass: false, text: `Add clear section heading${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.` });
  }

  // Tables / multi-column layouts often come out as many very short lines or pipe characters.
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const short = lines.filter((l) => l.length <= 3).length;
  const pipes = (text.match(/\|/g) || []).length;
  if (lines.length > 20 && (short / lines.length > 0.25 || pipes > 8)) {
    score -= 20;
    tips.push({ pass: false, text: 'Avoid tables and two-column layouts. ATS software can scramble them, so use one column.' });
  } else {
    tips.push({ pass: true, text: 'Single-column text that ATS software can read in order.' });
  }

  const words = text.split(/\s+/).filter(Boolean).length;
  if (pages > 2 || words > 1100) {
    score -= 15;
    tips.push({ pass: false, text: `Your resume is ${pages} pages. For freshers, keep it to 1 page (2 at most).` });
  } else if (words < 150) {
    score -= 25;
    tips.push({ pass: false, text: 'Very little text could be read. If your PDF is a scanned image, export it as a text PDF.' });
  } else {
    tips.push({ pass: true, text: `Good length (${pages} page${pages > 1 ? 's' : ''}).` });
  }

  return { tips, score: Math.max(0, Math.min(100, score)), sectionsFound: found };
}
