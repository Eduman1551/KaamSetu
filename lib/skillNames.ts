// Display names for normalised (lowercase) skill keys. Safe on client and server.
const DISPLAY: Record<string, string> = {
  excel: 'Excel', 'power bi': 'Power BI', sql: 'SQL', javascript: 'JavaScript', 'node.js': 'Node.js', react: 'React',
  'machine learning': 'Machine Learning', 'artificial intelligence': 'AI', communication: 'Communication',
  'problem solving': 'Problem Solving', 'data visualization': 'Data Visualization', statistics: 'Statistics',
  'c++': 'C++', 'c#': 'C#', aws: 'AWS', gcp: 'Google Cloud', 'rest apis': 'REST APIs', oop: 'OOP', python: 'Python',
  'data analysis': 'Data Analysis', teamwork: 'Teamwork', 'attention to detail': 'Attention to Detail', git: 'Git',
  html: 'HTML', css: 'CSS', docker: 'Docker', 'system design': 'System Design', java: 'Java', 'spring boot': 'Spring Boot',
  'data structures': 'Data Structures', pandas: 'Pandas', numpy: 'NumPy', matplotlib: 'Matplotlib', tableau: 'Tableau',
  typescript: 'TypeScript', mongodb: 'MongoDB', mysql: 'MySQL', postgresql: 'PostgreSQL', linux: 'Linux', kubernetes: 'Kubernetes',
  'google sheets': 'Google Sheets', 'data entry': 'Data Entry',
};

export function displaySkill(key: string, fallback?: string): string {
  const k = key.toLowerCase().trim();
  if (DISPLAY[k]) return DISPLAY[k];
  if (fallback) return fallback;
  return k.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
