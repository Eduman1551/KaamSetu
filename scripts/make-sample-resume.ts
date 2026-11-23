// Generates scripts/fixtures/sample-resume.pdf, a fictional fresher resume used for testing
// and for generating the pre-saved demo result. Run: pnpm tsx scripts/make-sample-resume.ts
import { chromium } from 'playwright';
import path from 'path';

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; margin: 0; line-height: 1.35; }
  h1 { font-size: 20pt; margin: 0; }
  h2 { font-size: 12pt; border-bottom: 1px solid #333; margin: 14px 0 6px; text-transform: uppercase; }
  p { margin: 2px 0; } ul { margin: 2px 0 0 18px; padding: 0; } li { margin: 2px 0; }
  .muted { color: #444; }
</style></head><body>
  <h1>Aarav Mehta</h1>
  <p class="muted">aarav.mehta.demo@example.com · +91 98765 43210 · Pune, Maharashtra · github.com/aarav-demo</p>

  <h2>Objective</h2>
  <p>Final-year Computer Engineering student looking for an entry-level Data Analyst role where I can turn data into clear business insights.</p>

  <h2>Education</h2>
  <p><b>B.E. Computer Engineering</b>, Savitribai Phule Pune University — 2023–2027 (expected) · CGPA 8.1/10</p>
  <p>Class XII (CBSE), 2023 — 88%</p>

  <h2>Skills</h2>
  <p><b>Languages:</b> Python, Java, C++</p>
  <p><b>Data:</b> Microsoft Excel (pivot tables, VLOOKUP), Pandas, NumPy, Matplotlib</p>
  <p><b>Web:</b> HTML, CSS, JavaScript</p>
  <p><b>Soft skills:</b> Communication, teamwork, problem solving</p>

  <h2>Projects</h2>
  <p><b>College Canteen Sales Analysis</b> — Python, Pandas, Matplotlib</p>
  <ul>
    <li>Cleaned 6 months of canteen sales data (12,000 rows) and found the 5 best-selling items.</li>
    <li>Made charts that helped the canteen cut food waste on slow days.</li>
  </ul>
  <p><b>Student Attendance Tracker</b> — Java</p>
  <ul>
    <li>Built a desktop app to record and export class attendance to Excel.</li>
  </ul>
  <p><b>Personal Portfolio Website</b> — HTML, CSS, JavaScript</p>
  <ul><li>Responsive portfolio site listing my projects.</li></ul>

  <h2>Experience</h2>
  <p><b>Data Entry Intern</b>, Local NGO, Pune — Jun 2025 to Jul 2025</p>
  <ul>
    <li>Worked on Excel sheets of donor records.</li>
    <li>Helped the team with reports.</li>
  </ul>

  <h2>Achievements</h2>
  <ul><li>Top 10 in college hackathon 2025.</li><li>NSS volunteer, 2024–2025.</li></ul>
</body></html>`;

const webHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; margin: 0; line-height: 1.35; }
  h1 { font-size: 20pt; margin: 0; }
  h2 { font-size: 12pt; border-bottom: 1px solid #333; margin: 14px 0 6px; text-transform: uppercase; }
  p { margin: 2px 0; } ul { margin: 2px 0 0 18px; padding: 0; } li { margin: 2px 0; }
  .muted { color: #444; }
</style></head><body>
  <h1>Aarav Sharma</h1>
  <p class="muted">aarav.sharma.demo@example.com · +91 98111 22334 · Jaipur, Rajasthan · github.com/aarav-sharma-demo</p>
  <h2>Objective</h2>
  <p>Final-year B.Tech Computer Science student seeking an entry-level Junior Web Developer role building fast, accessible web apps.</p>
  <h2>Education</h2>
  <p><b>B.Tech Computer Science and Engineering</b>, Rajasthan Technical University — 2022–2026 · CGPA 8.4/10</p>
  <h2>Skills</h2>
  <p><b>Frontend:</b> JavaScript (ES6+), React, HTML, CSS, Tailwind CSS</p>
  <p><b>Backend:</b> Node.js, Express, REST APIs</p>
  <p><b>Databases:</b> SQL (MySQL, PostgreSQL)</p>
  <p><b>Tools:</b> Git, GitHub, VS Code, Postman</p>
  <h2>Projects</h2>
  <p><b>Campus Events Portal</b> — React, Node.js, Express, PostgreSQL</p>
  <ul>
    <li>Built a full-stack portal used by 600+ students to discover and register for college events.</li>
    <li>Designed REST APIs and SQL schema; cut page load time by 35% with lazy loading.</li>
  </ul>
  <p><b>Expense Splitter</b> — JavaScript, React, Local Storage</p>
  <ul><li>Single-page app that splits group expenses; 4.8/5 rating from 40 classmates.</li></ul>
  <p><b>Library API</b> — Node.js, Express, MySQL</p>
  <ul><li>REST API with authentication and pagination, covered by 30 integration tests.</li></ul>
  <h2>Experience</h2>
  <p><b>Web Development Intern</b>, a local software agency — May 2025 to July 2025</p>
  <ul>
    <li>Shipped 6 responsive landing pages in React and fixed 25+ UI bugs reported by clients.</li>
    <li>Used Git pull requests and code reviews in a team of 4 developers.</li>
  </ul>
  <h2>Achievements</h2>
  <ul><li>Finalist, state-level hackathon 2025.</li></ul>
</body></html>`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html);
  const out = path.join(process.cwd(), 'scripts', 'fixtures', 'sample-resume.pdf');
  await page.pdf({ path: out, format: 'A4', margin: { top: '16mm', bottom: '16mm', left: '16mm', right: '16mm' } });
  // Second sample: the web-developer resume used for the demo student account.
  await page.setContent(webHtml);
  const outWeb = path.join(process.cwd(), 'scripts', 'fixtures', 'sample-resume-web.pdf');
  await page.pdf({ path: outWeb, format: 'A4', margin: { top: '16mm', bottom: '16mm', left: '16mm', right: '16mm' } });
  console.log('Wrote', outWeb);
  await browser.close();
  console.log('Wrote', out);
}
main();
