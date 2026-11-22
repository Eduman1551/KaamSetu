# KaamSetu (SkillBridge)

**Bridge the gap between your degree and your first job.**

KaamSetu is for final-year students and freshers in India. Upload a resume PDF and the app:

1. reads it with AI (target roles, skills, education),
2. finds **20 real, live job listings** in India for those roles on the web,
3. opens every listing in a real browser and extracts the skills employers ask for, **verifying every quote against the page text**,
4. shows your score, your in-demand strengths, the top 5 skills to add (each with 2 real courses), ATS tips,
5. and **3 proof cards**: real screenshots of live listings with the exact sentence highlighted.

No login, no database. The resume is processed in memory only and never stored.

> Core rule: every number comes from listings fetched live in that run. A skill with no listing evidence is never shown, and skill trends are labelled "trend from today's listings", not a guarantee.

---

## Setup

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
pnpm exec playwright install chromium
```

Add your keys to `.env.local` in the project root (see `.env.example` for the names):

| Variable | Default | Notes |
|---|---|---|
| `GROQ_API_KEY` | – | https://console.groq.com |
| `TAVILY_API_KEY` | – | https://tavily.com (web search) |
| `GROQ_MODEL_MAIN` | `llama-3.3-70b-versatile` | resume reading + final report |
| `GROQ_MODEL_FAST` | `llama-3.1-8b-instant` | per-listing skill extraction |
| `MAX_LISTINGS` | `20` | listings analysed per resume |
| `SESSION_TTL_MINUTES` | `30` | sessions auto-delete after this |
| `SCREENSHOT_TIMEOUT_MS` | `10000` | per proof screenshot |

If a configured Groq model is not available on your account (Groq retires models from time to time), the app automatically falls back to another available chat model (e.g. `openai/gpt-oss-120b`, `openai/gpt-oss-20b`) and logs a one-line warning. The same fallback is used when one model hits its rate limit.

Run it:

```bash
pnpm dev                    # development, http://localhost:3000
pnpm build && pnpm start    # production (recommended for the live demo)
```

Run it locally. Playwright needs a real Chromium, so this app is not meant for serverless hosting.

### Useful scripts

| Command | What it does |
|---|---|
| `pnpm make-demo` | Runs one real live analysis of `demo/sample-resume.pdf` and saves it as the demo result (`demo/result.json` + `demo/shots/*.jpg`). |
| `pnpm sample-resume` | Re-creates the fictional sample resume PDF. |
| `pnpm tsx scripts/test-analyze.ts [file.pdf]` | Posts a PDF to the running server and prints the live progress events. |
| `pnpm compress-bg` | Shrinks `public/bg.jpg` if it is over ~500 KB. |

---

## How it works

```
PDF ──► pdf-parse (in memory) ──► Groq: roles, skills, education
                                   │
        Tavily search (job boards that allow automated reading, company ATS boards, open web)
                                   │   filter: single listings only, skip login/bot-walled sites
        Playwright opens each page ─► quick code checks (India? right role? entry level? still open?)
                                   │
        Groq (fast model, 3 at a time): title, company, skills + exact quote
                                   │   every quote must exist in the page text, else dropped
        Aggregate counts ─► strengths / skills to add / scores
        Tavily ─► 2 real courses per missing skill (free first; hours only if stated)
        Groq (main model) ─► impact + structure scores, one-line summary, extra ATS tips, relevance
        Playwright ─► 3 proof screenshots (yellow <mark> on the sentence, 900×420 clip)
```

Progress is streamed to the browser with Server-Sent Events from `POST /api/analyze`.

* **Scores:** Skills match (share of today's demand you cover, weighted by frequency) 40%, ATS readability (code checks) 20%, Impact & bullets (AI) 20%, Structure (AI + sections found) 20%.
* **Proof cards:** the 3 skills with the highest frequency × relevance, at least 2 of them missing from the resume. If a page blocks the screenshot, the next listing for that skill is tried. If all fail, a text card shows the exact extracted sentence, labelled "Screenshot unavailable".
* **Rate limits:** prompts are kept small (listing text is trimmed to the requirements part), Groq 429s are retried with exponential backoff, and other models are used as fallbacks.

### Privacy Shield

* The resume is never written to disk (the upload is parsed in memory).
* Results live in an in-memory session (a `globalThis` Map) and auto-delete after `SESSION_TTL_MINUTES`.
* Proof screenshots are temp files in the OS temp folder, served only via random tokens (`/api/shot/<token>`).
* **Delete my data** (results page and footer) calls `DELETE /api/session/<id>`, which wipes the session and its screenshot files immediately.

### Project structure

```
pages/            index.tsx (single page), _app.tsx, _document.tsx
pages/api/        analyze.ts (SSE pipeline), session/[id].ts (delete), shot/[token].ts (screenshots)
components/       NavBar, Hero, HowItWorks, UploadZone, ProgressBridge, Results, ProofCard, Footer, ...
lib/types.ts      types shared by UI and API
lib/server/       server-only: groq, tavily, browser (Playwright), listings, skills, courses,
                  report, proof, screenshot, sessions, shots, resume, upload, pipeline
demo/             sample-resume.pdf, result.json + shots/ (pre-saved real run)
scripts/          make-demo, make-sample-resume, test-analyze, compress-bg
```

---

## 2-minute demo script

**Before class:** run `pnpm build && pnpm start`, open http://localhost:3000 on the projector, and zoom the browser to 100–125%. Have `demo/sample-resume.pdf` (or a volunteer's resume) ready. Presenter keys: **D** = load the demo result instantly, **R** = reset to the start.

| Time | Do | Say |
|---|---|---|
| 0:00 | Hero on screen. | "Every year lakhs of freshers don't know what employers actually want. KaamSetu bridges that gap using today's real job listings, not guesses." |
| 0:15 | Scroll to *How it works*. | "Three steps: upload, our AI scans 20 live listings, you get a plan." |
| 0:25 | Drop the resume in the upload box. Point at the privacy line. Click **Analyse my resume**. | "The resume stays in memory. Nothing is stored." |
| 0:30 | The bridge builds plank by plank. | "Right now it's searching the web, opening each job page in a real browser, and reading the requirements. Every quote it extracts is checked against the page, so nothing is made up." |
| ~1:30 | Results scroll in. Score ring counts up. | "Here's the score, and what it's made of." |
| 1:40 | Click *Strengths*, then *Skills to add*. | "Excel is in 12 of 20 listings, and you have it. SQL is in 12 of 20 too, and it's missing. Here are two free courses for it." |
| 1:50 | Click *Proof*, then open a screenshot. | "And here's the proof: a real listing, with the sentence highlighted." |
| 1:55 | Click **Delete my data**. | "One click and everything is wiped." |

**If the live run is slow or the Wi-Fi fails:** press **D** (or click *Switch to demo result*, shown after 90 s). The demo is a pre-saved real run and loads instantly.

---

Built for **Engineering for Social Empowerment**. Edit the team names in `components/Footer.tsx`.
