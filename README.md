# KaamSetu (SkillBridge)

**Bridge the gap between your degree and your first job.**

KaamSetu is a 3-role platform for India's freshers:

| Role | What they get |
|---|---|
| **Student** (final-year / fresher) | AI resume analysis against **12–20 live job listings**, real proof screenshots, courses for missing skills, a **hard 15-question AI skills test** to get **Verified**, insight into what companies want, and invites from companies. |
| **Company** | One single-page dashboard of **anonymous, verified** candidates ranked against their own hiring requirements, with analytics and interest invites. |
| **College** | One read-only page of **aggregate-only** cohort data (k ≥ 5): where students are lacking, what companies expect, the top 3 priority gaps and auto-generated workshop suggestions. |

Built for **Engineering for Social Empowerment**.

---

## Setup

Requirements: Node.js 20+ (22 recommended), pnpm, a [Neon](https://neon.tech) Postgres database, a [Groq](https://console.groq.com) key and a [Tavily](https://tavily.com) key.

```bash
pnpm install
pnpm exec playwright install chromium   # local only: Chromium for the 3 proof screenshots
```

Create `.env.local` in the project root (names are in `.env.example`):

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string (host contains `-pooler`, `?sslmode=require`) |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | any long random string, e.g. `openssl rand -base64 32` |
| `GROQ_API_KEY`, `TAVILY_API_KEY` | API keys |
| `GROQ_MODEL_MAIN` | default `llama-3.3-70b-versatile` (we use `openai/gpt-oss-120b`) |
| `GROQ_MODEL_FAST` | default `llama-3.1-8b-instant` (we use `openai/gpt-oss-20b`) |
| `MAX_LISTINGS` | listings per analysis, default `20` locally and `12` on Vercel |
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
2. Tavily finds live fresher listings in India. Each page is read with a **plain HTTP fetch + HTML-to-text** (including schema.org JobPosting data). Cheap code checks skip closed, foreign, senior or wrong-role pages before any AI call.
3. Groq (fast model, 3 at a time) extracts skills with an exact quote; **every quote is verified against the page text**.
4. Skill counts → strengths, top 5 skills to add (2 real courses each, found by Tavily), ATS tips, score.
5. 3 proof cards: real screenshots of the listing with the sentence highlighted. A headless browser is used **only** here (Playwright locally, `@sparticuz/chromium` on Vercel); if it can't launch or a page blocks it, the card shows the exact sentence instead ("Screenshot unavailable").
6. Saved to Postgres (latest analysis only). Screenshots are stored as compressed **webp in `analysis_shots`** and served only to their owner.
7. The run's status (`running` / `done` / `failed`) is stored in `analysis_runs`. If the stream drops, the server still finishes and saves, and the page recovers by polling every 2 seconds (or on refresh).
8. The browser then calls `POST /api/test/prepare` to generate the skills test. If the student presses **Start** before it's ready, they see "Preparing your test" while it is generated.
9. A time budget keeps every run inside the 300-second function limit: listing scanning stops early (with at least 5 listings) and screenshots are skipped when time is short.

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
- Rate limits (stored in the `rate_limits` table, so they hold across serverless instances): login 5 failures / 15 min per email + IP, test generation 3 / hour, analyses 6 / hour, invites 20 / day.
- zod validation on every input, parametrised queries only (Drizzle), JSON-only writes, security headers, no secrets / resume text / answer keys in logs.

### Project structure
```
pages/                landing, login, signup, dashboard/{student,company,college}, student/test/[id]
                      (dashboards use the warm light theme; landing/auth keep the dark navy look)
pages/api/            analyze, test/prepare, auth, student/*, company/*, college/*, account/password
components/           UI (AnalysisFlow, Results, ProofCard, charts, student/*, company/*, …)
lib/                  shared pure logic: scoring, coreSkills, redact, companyDto, collegeStats, validation
lib/server/           server-only: db (neon-http + Pool), auth, guard, groq, tavily, pageText, browser,
                      pipeline, analysisRuns, rateLimit, testGen, questionFactory, testRun, company, college, student
scripts/              db-reset, seed-demo, seed-sample, make-fixture, fixtures, sample resume, test-analyze
tests/                vitest unit tests
```

---

## 3-minute demo script

Run `pnpm build && pnpm start`. Open three browser windows (or one normal + two private windows).

| Time | Role | Do | Say |
|---|---|---|---|
| 0:00 | – | Landing page. | "KaamSetu connects freshers, companies and colleges through **verified** skills." |
| 0:15 | Student | Log in as `student@demo.com`. Overview → *Resume Analysis*. | "Aarav's resume was analysed against real live listings. Here's the score, missing skills with free courses, and real screenshots as proof." |
| 0:45 | Student | *Verify My Skills* → read the rules → **Start the test**. Answer 1–2 questions, point at the timer and the code question. | "15 hard questions generated by AI and double-checked by a second AI. The timer runs on the server; answers autosave." |
| 1:15 | Student | (Optional, if time) *Analyse a new resume* with `scripts/fixtures/sample-resume-web.pdf` to show the live bridge animation. | "This reads today's listings live: one to two minutes." |
| 1:30 | Company | Log in as `company@demo.com`. Show the Junior Web Developer requirement, the charts, then open Aarav's anonymous card. | "Companies only see an anonymous code and verified scores, ranked by match to *their* requirement. No names, no college." |
| 2:00 | Company | Send interest to a candidate. Scroll to *Accepted invites*. | "Contact details appear only after the student accepts." |
| 2:20 | College | Log in as `college@demo.com`. Scroll the single page: lacking skills, company expectations, priority gaps, suggested workshops. | "Colleges see cohort totals only, never individuals. The page shows exactly where students fall short of what companies want, with a ready workshop plan for each gap." |
| 2:50 | – | Back to the student's *Settings*: visibility toggle and the "How companies see you" preview. | "Students stay in control: hidden by default, visible only once verified." |

After the demo, run `pnpm db:seed:demo` again to reset the demo accounts (the 3-day retake cooldown otherwise applies to the demo student).

---

## Deploy to Vercel

The app is ready to import into Vercel as-is (Next.js, Node runtime).

| Setting | Value | Where |
|---|---|---|
| Function max duration | **300 s** for `/api/analyze` and `/api/test/prepare` (the Hobby maximum with Fluid compute; Pro allows up to 800 s) | `export const config = { maxDuration: 300 }` in those routes |
| Region | **`sin1`** (Singapore), next to the Neon database in `ap-southeast-1` | `vercel.json` |
| Install command | `pnpm install --frozen-lockfile` (pnpm 11, from `packageManager`) | `vercel.json` |
| Node.js | 20 or newer (`engines.node`) | `package.json` |
| Browser | `playwright-core` + `@sparticuz/chromium`, picked automatically when `VERCEL` is set; the binary is shipped with `/api/analyze` via `outputFileTracingIncludes` | `lib/server/browser.ts`, `next.config.js` |

Steps:

1. **Once, locally, against Neon:** `pnpm db:push` and `pnpm db:seed:demo` (migrations never run during the Vercel build).
2. **Import** the GitHub repo in Vercel (Framework preset: Next.js; leave build and output settings at their defaults).
3. **Environment variables** (Production, and Preview if you use it):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon **pooled** connection string |
   | `NEXTAUTH_URL` | your Vercel URL, e.g. `https://kaamsetu.vercel.app` |
   | `NEXTAUTH_SECRET` | a long random string (`openssl rand -base64 32`) |
   | `GROQ_API_KEY` | your Groq key |
   | `TAVILY_API_KEY` | your Tavily key |
   | `GROQ_MODEL_MAIN` | `openai/gpt-oss-120b` |
   | `GROQ_MODEL_FAST` | `openai/gpt-oss-20b` |
   | `MAX_LISTINGS` | `12` |
   | `SCREENSHOT_TIMEOUT_MS` | `10000` |
   | `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` | `1` (never download Playwright browsers on Vercel) |
   | `ENABLE_EXPERIMENTAL_COREPACK` | `1` (recommended: makes Vercel use exactly pnpm 11.9.0 from `packageManager`) |

4. **Deploy.**
5. **Smoke test** on the deployed URL:
   - [ ] Landing, `/login` and `/signup` load.
   - [ ] Log in as `student@demo.com`: Overview, Resume Analysis (saved result with 3 screenshots), Settings.
   - [ ] Run one analysis with `scripts/fixtures/sample-resume-web.pdf`: progress streams and the result appears (refresh mid-run: it should recover). Check whether the proof cards show screenshots or "Screenshot unavailable".
   - [ ] *Verify My Skills* → **Start**: "Preparing your test" appears, then the test opens. Answer, submit, see the result.
   - [ ] Log in as `company@demo.com`: KPIs, charts, Aarav's anonymous card, send an invite.
   - [ ] Log in as `college@demo.com`: stats, bars, priority gaps, workshop cards (these need 5+ tested students; with only the demo student the page shows "Not enough student data yet". Run `pnpm seed:sample` locally for fuller data).
   - [ ] Afterwards, re-run `pnpm db:seed:demo` locally to reset the demo accounts.

NextAuth v4 on Vercel only needs `NEXTAUTH_URL` and `NEXTAUTH_SECRET` (cookies are secure automatically on https; the v5 `trustHost` option does not apply to v4).

---

## Known limitations

- **No email verification and no password reset** yet (future work).
- **Groq free-tier limits** (about 8k tokens per minute per model, plus daily caps): an analysis uses about 25–40k tokens and a test about 15k. The app retries with backoff and rotates models, but heavy use can still hit limits.
- **Function time limit**: on Vercel Hobby a run must finish within 300 s, so analyses use 12 listings by default and may skip screenshots when time is short.
- Some job sites block automated readers (e.g. Naukri, foundit), so listings come mostly from boards that allow it and company career pages. Pages that render only with JavaScript give less text.
- Proof screenshots on Vercel depend on `@sparticuz/chromium`; if it can't start, cards fall back to the exact quoted sentence.
- Skill trends are a signal from today's listings, not a guarantee.
