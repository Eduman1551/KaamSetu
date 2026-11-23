# KaamSetu (SkillBridge)

**Bridge the gap between your degree and your first job.**

KaamSetu is a 3-role platform for India's freshers:

| Role | What they get |
|---|---|
| **Student** (final-year / fresher) | AI resume analysis against **20 live job listings**, real proof screenshots, courses for missing skills, a **hard 15-question AI skills test** to get **Verified**, insight into what companies want, and invites from companies. |
| **Company** | One single-page dashboard of **anonymous, verified** candidates ranked against their own hiring requirements, with analytics and interest invites. |
| **College** | One read-only page of **aggregate-only** cohort data (k ≥ 5): where students are lacking, what companies expect, the top 3 priority gaps and auto-generated workshop suggestions. |

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
pnpm db:push        # create the tables in Neon
pnpm db:seed:demo   # the 3 demo accounts below (idempotent)
pnpm dev            # http://localhost:3000
```

Database scripts:

| Command | What it does |
|---|---|
| `pnpm db:reset --yes` | Empties **all** tables (schema kept). Refuses to run without `--yes`. |
| `pnpm db:seed:demo` | Creates exactly the 3 demo accounts (safe to run again). |
| `pnpm seed:sample` | **Optional**, never run by default or on deploy: adds ~40 clearly synthetic students (`is_synthetic = true`, cannot log in) linked to the demo college so the company and college dashboards look fuller. `pnpm seed:sample --remove` deletes them again. |
| `pnpm db:studio` | Browse the database. |

Other scripts: `pnpm test` (vitest), `pnpm sample-resume` (re-creates the sample resume PDFs in `scripts/fixtures/`).

### Demo accounts

| Role | Email | Password | What's there |
|---|---|---|---|
| Student | `student@demo.com` | `Demo@1234` | Aarav Sharma, B.Tech 2026, verified (80%), visible to companies, one saved analysis, linked to the demo college |
| Company | `company@demo.com` | `Demo@1234` | TechNova Pvt Ltd, one open requirement: Junior Web Developer |
| College | `college@demo.com` | `Demo@1234` | Demo Institute of Technology, join code `DEMO-2026` |

> **Demo credentials are for presentation only. Delete these accounts or change the passwords before any real use.**

The demo student's saved analysis is one real live run on `scripts/fixtures/sample-resume-web.pdf` (see `scripts/make-fixture.ts`), so every number in it comes from real listings.

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
One simple read-only page: students linked, % verified, average test score, % tested; the 6 weakest skills; the 6 most demanded skills; the top 3 **priority gaps** (gap index = company demand % × (100 − student average %) / 100); and 3 workshop suggestions. Workshops are generated by Groq automatically the first time the data changes meaningfully (a 5-point move in the average or a 10-point move in demand) and cached in the DB. A skill is shown only if **at least 5 linked students** were tested on it. No individual student data appears anywhere.

### Security
- NextAuth credentials with bcrypt (cost 12), JWT session carrying `id` + `role`, httpOnly cookies.
- `requireRole()` on every dashboard page and a role check on **every** API route (re-reads the user from the DB, so deleted accounts are locked out at once).
- Rate limits: login 5 failures / 15 min per email + IP, test generation 3 / hour, analyses 6 / hour, invites 20 / day.
- zod validation on every input, parametrised queries only (Drizzle), JSON-only writes, security headers, no secrets / resume text / answer keys in logs.

### Project structure
```
pages/                landing, login, signup, dashboard/{student,company,college}, student/test/[id]
                      (dashboards use the warm light theme; landing/auth keep the dark navy look)
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
| 0:15 | Student | Log in as `student@demo.com`. Overview → *Resume Analysis*. | "Aarav's resume was analysed against 20 live listings. Here's the score, missing skills with free courses, and real screenshots as proof." |
| 0:45 | Student | *Verify My Skills* → read the rules → **Start the test**. Answer 1–2 questions, point at the timer and the code question. | "15 hard questions generated by AI and double-checked by a second AI. The timer runs on the server; answers autosave." |
| 1:15 | Student | (Optional, if time) *Analyse a new resume* with `scripts/fixtures/sample-resume.pdf` to show the live bridge animation. | "This reads today's listings live: about a minute." |
| 1:30 | Company | Log in as `company@demo.com`. Show the Junior Web Developer requirement, the charts, then open Aarav's anonymous card. | "Companies only see an anonymous code and verified scores, ranked by match to *their* requirement. No names, no college." |
| 2:00 | Company | Send interest to a candidate. Scroll to *Accepted invites*. | "Contact details appear only after the student accepts." |
| 2:20 | College | Log in as `college@demo.com`. Scroll the single page: lacking skills, company expectations, priority gaps, suggested workshops. | "Colleges see cohort totals only, never individuals. The page shows exactly where students fall short of what companies want, with a ready workshop plan for each gap." |
| 2:50 | – | Back to the student's *Settings*: visibility toggle and the "How companies see you" preview. | "Students stay in control: hidden by default, visible only once verified." |

After the demo, run `pnpm db:seed:demo` again to reset the demo accounts (the 3-day retake cooldown otherwise applies to the demo student).

---

## Known limitations

- **No email verification and no password reset** yet (future work).
- **Runs locally only**: Playwright needs a real Chromium, so serverless hosting (e.g. Vercel functions) is not supported.
- **Groq free-tier limits** (≈8k tokens/minute per model, daily caps): an analysis uses ≈25–40k tokens and a test ≈15k. The app retries with backoff and rotates models, but heavy use can still hit limits.
- Some job sites block automated browsers (e.g. Naukri, foundit), so listings come mostly from boards that allow it and company career pages.
- Rate limits and background test generation are in-memory (single server process); a multi-server deploy would need Redis or a job queue.
- Skill trends are a signal from today's listings, not a guarantee.
