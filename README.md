# KaamSetu (SkillBridge)

**Bridge the gap between your degree and your first job.**

KaamSetu is a 3-role platform for India's freshers:

| Role | What they get |
|---|---|
| **Student** (final-year / fresher) | AI resume analysis against **20 live job listings**, real proof screenshots, courses for missing skills, a **hard 15-question AI skills test** to get **Verified**, insight into what companies want, and invites from companies. |
| **Company** | One single-page dashboard of **anonymous, verified** candidates ranked against their own hiring requirements, with analytics and interest invites. |
| **College** | **Aggregate-only** cohort skill gaps (k ≥ 5), a verified-rate trend, AI-suggested workshops and a CSV report. |

Built for **Engineering for Social Empowerment**.

---

## Setup

Requirements: Node.js 20+ (22 recommended), pnpm, a [Neon](https://neon.tech) Postgres database, a [Groq](https://console.groq.com) key and a [Tavily](https://tavily.com) key.

```bash
pnpm install
pnpm exec playwright install chromium
```

Create `.env.local` in the project root (names are in `.env.example`):

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon connection string (`postgresql://…?sslmode=require`) |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | any long random string, e.g. `openssl rand -base64 32` |
| `GROQ_API_KEY`, `TAVILY_API_KEY` | API keys |
| `GROQ_MODEL_MAIN` | default `llama-3.3-70b-versatile` (we use `openai/gpt-oss-120b`) |
| `GROQ_MODEL_FAST` | default `llama-3.1-8b-instant` (we use `openai/gpt-oss-20b`) |
| `MAX_LISTINGS` | listings per analysis, default `20` |
| `SCREENSHOT_TIMEOUT_MS` | per proof screenshot, default `10000` |
| `SHOW_SYNTHETIC` | show seeded sample students to companies/colleges, default `true` |

If a configured Groq model is not available on your account, the app falls back to another available chat model automatically (also when one model hits its rate limit).

```bash
pnpm db:push     # create the tables in Neon
pnpm seed        # sample college, companies, 60 synthetic students + 3 demo logins
pnpm dev         # http://localhost:3000
```

For the class demo use the production build: `pnpm build && pnpm start`.

Other scripts: `pnpm test` (vitest), `pnpm db:studio` (browse the DB), `pnpm sample-resume` (re-creates `scripts/fixtures/sample-resume.pdf`).

### Demo accounts (created by `pnpm seed`)

Password for all three: **`KaamSetu@2026`**

| Role | Email | Starts with |
|---|---|---|
| Student | `student.demo@kaamsetu.test` | linked to the demo college, a saved resume analysis, **not yet verified** (so you can take the test) |
| Company | `company.demo@kaamsetu.test` | Nimbus Analytics, 2 open requirements, 20 visible verified candidates |
| College | `college.demo@kaamsetu.test` | Kaveri Institute of Technology, join code **`KIT-7F3A9`**, 53 linked students |

`pnpm seed` is idempotent: it only rewrites rows owned by the reserved `kaamsetu.test` domains and synthetic students (`is_synthetic = true`). Real users are never touched, and real sign-ups cannot use those domains. Seeded rows show an "Includes sample data" chip.

---

## How it works

### Resume analysis (students)
`POST /api/analyze` streams progress with Server-Sent Events:
1. The PDF is parsed **in memory** (pdf-parse). Groq reads it: target roles, skills, education.
2. Tavily finds live fresher listings in India; Playwright opens each page; cheap code checks skip closed, foreign, senior or wrong-role pages before any AI call.
3. Groq (fast model, 3 at a time) extracts skills with an exact quote; **every quote is verified against the page text**.
4. Skill counts → strengths, top 5 skills to add (2 real courses each, found by Tavily), ATS tips, score.
5. 3 proof cards: real screenshots of the listing with the sentence highlighted.
6. Saved to Postgres (latest analysis only). Screenshots are stored as compressed **webp in `analysis_shots`** and served only to their owner. A skills test is then pre-generated in the background.

The raw PDF and raw resume text are **never stored**. Only structured data is kept, plus `redacted_highlights`: max 5 generic bullets written by Groq, then scrubbed by code (emails, phones, URLs, handles, the student's own name, email prefix and college name → the bullet is dropped).

### Skills test
- **Core skills:** testable resume skills that also appear in the analysed listings, ranked by demand then resume order, top 5 (min 3). 15 questions split 5×3, 4/4/4/3 or 3×5.
- **Generation:** Groq main model writes scenario / code-output / debugging / trade-off MCQs (≈20% medium, 60% hard, 20% expert). A **blind solver** (fast model) answers each without the key; disagreements or ambiguity are regenerated (2 retries, then new angles). Question hashes are never reused for the same student. Options and question order are shuffled server-side.
- **Taking it:** one question per screen, server-owned timer (30 min + 60 s grace, then auto-submit), autosave, flag for review. `correct_index` and explanations are never sent before submission.
- **Integrity:** tab switches and pastes are counted; warning at 3, **flagged at 6** (no verification). No webcam.
- **Rules** (`lib/server/testConfig.ts`): pass 11/15 (73%), distinction 13/15, a skill is verified with ≥ 2/3 of its questions, 3-day cooldown, max 3 attempts per 30 days, verification lasts 12 months.

### Company matching
`match % = Σ(weight × verified skill score) / Σ(weight) × 100` (unverified skills count as 0). Candidates missing a must-have are hidden unless "Show partial matches" is on. Companies only ever receive data built by **`toCompanyCandidateDTO()`** (anon code, graduation year, education level, test score, flags, per-skill scores, redacted highlights). Name and email appear **only after the student accepts an invite**. Invites are limited to 20 per company per day.

### College insights
Aggregates only. Any statistic based on **fewer than 5 students** is hidden ("Not enough data yet"; small counts show as "<5"). **Gap index = company demand % × (100 − average score %) / 100**; the top 5 are priority gaps, each with an AI workshop plan (cached in the DB).

### Security
- NextAuth credentials with bcrypt (cost 12), JWT session carrying `id` + `role`, httpOnly cookies.
- `requireRole()` on every dashboard page and a role check on **every** API route (re-reads the user from the DB, so deleted accounts are locked out at once).
- Rate limits: login 5 failures / 15 min per email + IP, test generation 3 / hour, analyses 6 / hour, invites 20 / day.
- zod validation on every input, parametrised queries only (Drizzle), JSON-only writes, security headers, no secrets / resume text / answer keys in logs.

### Project structure
```
pages/                landing, login, signup, dashboard/{student,company,college}, student/test/[id]
pages/api/            analyze, auth, student/*, company/*, college/*, account/password
components/           UI (AnalysisFlow, Results, ProofCard, charts, student/*, company/*, …)
lib/                  shared pure logic: scoring, coreSkills, redact, companyDto, collegeStats, validation
lib/server/           server-only: db (Drizzle schema), auth, guard, groq, tavily, browser, pipeline,
                      testGen, questionFactory, testRun, company, college, student
scripts/              seed, fixtures, sample resume, test-analyze
tests/                vitest unit tests
```

---

## 3-minute demo script

Run `pnpm build && pnpm start`. Open three browser windows (or one normal + two private windows).

| Time | Role | Do | Say |
|---|---|---|---|
| 0:00 | – | Landing page. | "KaamSetu connects freshers, companies and colleges through **verified** skills." |
| 0:15 | Student | Log in as `student.demo@kaamsetu.test`. Overview → *Resume Analysis*. | "Aarav's resume was analysed against 20 live listings. Here's the score, missing skills with free courses, and real screenshots as proof." |
| 0:45 | Student | *Verify My Skills* → read the rules → **Start the test**. Answer 1–2 questions, point at the timer and the code question. | "15 hard questions generated by AI and double-checked by a second AI. The timer runs on the server; answers autosave." |
| 1:15 | Student | (Optional, if time) *Analyse a new resume* with `scripts/fixtures/sample-resume.pdf` to show the live bridge animation. | "This reads today's listings live: about a minute." |
| 1:30 | Company | Log in as `company.demo@kaamsetu.test`. Switch requirement, show charts, open a candidate. | "Companies only see an anonymous code and verified scores, ranked by match to *their* requirement. No names, no college." |
| 2:00 | Company | Send interest to a candidate. Scroll to *Accepted invites*. | "Contact details appear only after the student accepts." |
| 2:20 | College | Log in as `college.demo@kaamsetu.test`. Overview trend → *Skill Gaps* → *Workshops* → **Suggest a workshop** on Docker. | "Colleges see cohort totals only, never individuals. Docker and System Design are the priority gaps, so here's a 1-day workshop plan." |
| 2:50 | – | Back to the student's *Settings*: visibility toggle and the "How companies see you" preview. | "Students stay in control: hidden by default, visible only once verified." |

After the demo, run `pnpm seed` again to reset the demo accounts (the 3-day retake cooldown otherwise applies to the demo student).

---

## Known limitations

- **No email verification and no password reset** yet (future work).
- **Runs locally only**: Playwright needs a real Chromium, so serverless hosting (e.g. Vercel functions) is not supported.
- **Groq free-tier limits** (≈8k tokens/minute per model, daily caps): an analysis uses ≈25–40k tokens and a test ≈15k. The app retries with backoff and rotates models, but heavy use can still hit limits.
- Some job sites block automated browsers (e.g. Naukri, foundit), so listings come mostly from boards that allow it and company career pages.
- Rate limits and background test generation are in-memory (single server process); a multi-server deploy would need Redis or a job queue.
- Skill trends are a signal from today's listings, not a guarantee.
