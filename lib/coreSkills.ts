// Which resume skills go into the skills test (pure, unit-tested).
import { MAX_CORE_SKILLS } from './server/testConfig';

/** Soft or generic skills that a multiple-choice test can't fairly verify. */
const NOT_TESTABLE = new Set([
  'communication', 'teamwork', 'problem solving', 'attention to detail', 'leadership', 'time management',
  'data entry', 'analytical thinking', 'analytical skills', 'critical thinking', 'ms office', 'microsoft office',
  'english', 'presentation', 'presentation skills', 'collaboration', 'creativity', 'adaptability',
  'interpersonal skills', 'web', 'research', 'documentation', 'reporting', 'customer service', 'multitasking',
]);

export function isTestable(skill: string) {
  const s = skill.toLowerCase().trim();
  return s.length > 0 && !NOT_TESTABLE.has(s) && !/skills?$/.test(s);
}

/**
 * Resume skills that are testable AND appear in the analysed listings,
 * ordered by listing demand, then by resume prominence (order of mention). Top 5.
 */
export function selectCoreSkills(demand: { key: string; count: number; has: boolean }[], resumeOrder: string[]): string[] {
  const pos = (k: string) => {
    const i = resumeOrder.indexOf(k);
    return i < 0 ? 999 : i;
  };
  return demand
    .filter((d) => d.has && d.count > 0 && isTestable(d.key))
    .sort((a, b) => b.count - a.count || pos(a.key) - pos(b.key))
    .slice(0, MAX_CORE_SKILLS)
    .map((d) => d.key);
}
