// Skill name normalisation so "MS Excel", "Advanced Excel" and "excel" count as one skill.

// canonical key -> aliases (all lowercase)
const ALIASES: Record<string, string[]> = {
  excel: ['ms excel', 'microsoft excel', 'advanced excel', 'excel sheets', 'spreadsheets', 'ms-excel'],
  'power bi': ['powerbi', 'microsoft power bi', 'power-bi'],
  sql: ['structured query language', 'sql queries', 'sql querying', 'writing sql queries'],
  javascript: ['js', 'java script', 'javascript (es6)', 'es6'],
  'node.js': ['node', 'nodejs', 'node js'],
  react: ['react.js', 'reactjs', 'react js'],
  'machine learning': ['ml'],
  'artificial intelligence': ['ai'],
  communication: ['communication skills', 'verbal communication', 'written communication', 'good communication', 'excellent communication', 'verbal and written communication', 'english communication'],
  'problem solving': ['problem-solving', 'problem solving skills', 'analytical problem solving'],
  'data visualization': ['data visualisation', 'visualization', 'visualisation', 'dashboards', 'dashboarding'],
  statistics: ['statistical analysis', 'stats', 'statistical methods'],
  'c++': ['cpp'],
  aws: ['amazon web services'],
  gcp: ['google cloud', 'google cloud platform'],
  'rest apis': ['rest api', 'restful apis', 'restful api', 'apis'],
  oop: ['oops', 'object oriented programming', 'object-oriented programming'],
  python: ['python3', 'python programming'],
  'data analysis': ['data analytics', 'analyzing data', 'analysing data'],
  teamwork: ['team work', 'team player', 'collaboration'],
  'attention to detail': ['detail oriented', 'detail-oriented'],
  git: ['git/github', 'github', 'version control'],
};

const ALIAS_TO_KEY = new Map<string, string>();
for (const [key, list] of Object.entries(ALIASES)) {
  ALIAS_TO_KEY.set(key, key);
  for (const a of list) ALIAS_TO_KEY.set(a, key);
}

/** Lowercase canonical key for a skill name. */
export function skillKey(name: string): string {
  let s = name.toLowerCase().trim();
  s = s.replace(/[“”"'`()]/g, '').replace(/\s+/g, ' ');
  s = s.replace(/\b(skills?|programming|language|knowledge of|proficiency in|basic|strong|good)\b/g, '').replace(/\s+/g, ' ').trim();
  s = s.replace(/[.,;:]+$/, '');
  return ALIAS_TO_KEY.get(s) ?? s;
}

// Nice display names for canonical keys.
const DISPLAY: Record<string, string> = {
  excel: 'Excel', 'power bi': 'Power BI', sql: 'SQL', javascript: 'JavaScript', 'node.js': 'Node.js', react: 'React',
  'machine learning': 'Machine Learning', 'artificial intelligence': 'AI', communication: 'Communication',
  'problem solving': 'Problem Solving', 'data visualization': 'Data Visualization', statistics: 'Statistics',
  'c++': 'C++', aws: 'AWS', gcp: 'Google Cloud', 'rest apis': 'REST APIs', oop: 'OOP', python: 'Python',
  'data analysis': 'Data Analysis', teamwork: 'Teamwork', 'attention to detail': 'Attention to Detail', git: 'Git',
};

/** Display name: canonical one if we have it, else the listing's own spelling. */
export function skillDisplay(key: string, fallback: string): string {
  return DISPLAY[key] ?? fallback;
}

/** Things that are not skills (degrees, experience, etc.). */
export function isNoise(key: string): boolean {
  return (
    key.length < 1 ||
    key.length > 40 ||
    /\b(degree|bachelor|master|b\.?tech|b\.?e\b|graduate|years?|experience|fresher|salary|location|immediate joiner|english|hindi)\b/.test(key) ||
    /^(web|computer|computers|it|software|technology|tools|data|internet|laptop|office|reporting)$/.test(key)
  );
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Does `text` mention this skill (or any alias), as a whole word? */
export function textMentions(text: string, key: string): boolean {
  const names = [key, ...(ALIASES[key] ?? [])].filter((n) => n.length >= 2 && n !== 'ai' && n !== 'apis');
  return names.some((n) => {
    const re = new RegExp(`(^|[^a-z0-9+#])${escapeRe(n)}($|[^a-z0-9+#])`, 'i');
    return re.test(text);
  });
}
