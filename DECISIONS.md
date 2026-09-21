# AI Interview Prep Kit: Architecture Decisions

This document records the core architectural and implementation decisions for the AI Interview Prep Kit assessment (FS-AI-INTERVIEW-01), as required by the assignment guidelines and engineering standards in AGENTS.MD.

---

## D1. Stack and Repository Layout

- **Decision:** Use an npm workspaces monorepo with TypeScript containing four isolated packages:
  - `packages/core`: Pure pipeline logic, schemas, retrieval, LLM orchestration, coverage, and scheduling. No Express or MongoDB dependencies.
  - `packages/server`: Node.js + Express API, session authentication, MongoDB models, background jobs.
  - `packages/web`: Next.js (App Router) + Tailwind CSS, accessible components, real-time generation progress, and builder.
  - `packages/cli`: Standalone CLI tool running `npm run evaluate -- --input <cases.json> --output <kits.json>` importing `packages/core` directly.
- **Reason:** Guarantees that the batch evaluation script runs from a clean clone without requiring a running database or manual build steps, while sharing identical pipeline logic with the web application.
- **Consequence in code:** Strict architectural boundary preventing `packages/core` from importing `express`, `mongoose`, or `mongodb`.
- **Consequence in README:** Clear architecture diagram demonstrating pure core engine shared between CLI and Web/Server.

---

## D2. LLM Provider, Quota Management, and Fallback

- **Decision:**
  - Primary: `gemini-3.1-flash-lite` (or `gemini-3.5-flash-lite`) via Google AI Studio. ~500 RPD on the free tier. Checked 21 Sep 2026.
  - Fallback 1 (optional): Mistral via `api.mistral.ai/v1` (OpenAI-compatible). Free mode on by default for new accounts. No fixed daily allowance published; tracker reports ~1 request per second. Opt out of training data use in Admin Console under Privacy before use. Verify Indian phone number works during signup before building against it.
  - Fallback 2 (optional): GLM-4.7-Flash via `api.z.ai/api/paas/v4` (international, email signup only). Priced at free. Concurrency limit of 1. Use only 4.7 (4.5 is being retired).
  - Groq: not in the ordered chain. Its 8K TPM free limit is too small; one full extraction prompt can half-use it.
  - OpenRouter free models: capped at 50 RPD until credits are purchased. Not used.
  - Qwen: not accessible from India. Not used.
  - DeepSeek and Kimi: require payment. Not used.
  - **Provider chain is a generic ordered list** driven entirely by environment variables. No provider name is hard-coded. Each entry has its own base URL, key, model name, RPM, TPM, and concurrency. Swap or extend providers by changing `.env` alone. See `LLM_PROVIDER_1_*` through `LLM_PROVIDER_3_*` in `.env.example`.
  - Rate limit discrimination:
    - Per-minute 429: honour `Retry-After`, then exponential backoff with 25 percent jitter, cap 60 s, max 5 attempts.
    - Daily-quota 429 (no `Retry-After`, or `Retry-After` > 300 s): fail over to next provider immediately without waiting.
  - Circuit breaker: after 3 consecutive failures from one provider, mark it on cooldown for 5 minutes. Skip it in subsequent calls.
  - Call trace: record provider name, model, estimated tokens, latency in ms, attempt number, and outcome on every call.
  - Development cache: `LLM_DEV_CACHE=true` stores responses keyed by SHA-256 of prompt + model in `.cache/llm/`. Committed to `.gitignore`. Off by default.
- **Reason:** Prevents pipeline crashes during multi-case evaluation. Graders set only the keys they have; the chain degrades gracefully to a single-provider setup when fallback keys are absent.


---

## D3. Source for Public Interview Discussion

- **Decision:** Use the Hacker News Search API (Algolia) as the primary public discussion source.
- **Reason:** Completely free, requires no API credentials, returns structured JSON, and imposes no restrictive browser scraping blocks. Candidates such as Glassdoor, Reddit, and LinkedIn restrict automated scraping and violate terms of service.
- **Relevance Filter:** Plain deterministic code filter checking that hit titles or text contain the target company name along with interview-related keywords (`interview`, `hiring process`, `take-home`, `onsite`, `recruiter`, `screen`).
- **Zero Hits Handling:** Gracefully transition to `status: "none_found"` without throwing or aborting the run.

---

## D4. Coverage Passes and Stopping Rule

- **Decision:** Maximum of 2 repair rounds following initial question generation (maximum 3 passes total). After repair round 2, any remaining uncovered must-have requirement receives a deterministic fallback question generated directly from the requirement text (`Describe your experience with: <requirement text>. Give a concrete example.`).
- **Reason:** Round 1 rectifies accidental model omissions. Round 2 catches invalid requirement IDs. A third round rarely yields improvements while expending call quota. The deterministic fallback strictly guarantees that no kit ever ships with an uncovered must-have requirement.
- **Metric:** `coverage.passes` records the exact count of verification passes executed.

---

## D5. Requirement Priority Mapping (Must vs Nice)

- **Decision:** Explicit linguistic and contextual mapping:
  - `must`: Items under headings such as "Requirements", "Qualifications", "Must Have", "What You Need"; statements with explicit mandates ("required", "must", "essential", "minimum"); concrete experience thresholds ("5+ years of React").
  - `nice`: Items under headings such as "Nice to Have", "Preferred", "Bonus", "Plus"; hedged phrasing ("familiarity with", "exposure to", "bonus if", "ideally").
  - Default: In the absence of headings or cue words, concrete skills and tools default to `must`, while hedged statements default to `nice`.
  - Atomicity Rule: Distinct skills (such as "Node, PostgreSQL, and Redis") decompose into separate requirements when listed as individual requirements. Alternative lists ("React, Vue, or Angular") remain a single requirement.

---

## D6. Unreachable Company Site Handling

- **Decision:** When a company site is invalid, unreachable (404, DNS error, timeout), or blocked, the pipeline completes with `status: "ok"`, recording warning `COMPANY_UNREACHABLE` or `COMPANY_URL_INVALID`. The company brief reports that online information was unavailable and summarizes the job description alone.
- **Reason:** In alignment with assessment guidelines, partial research is an honest, acceptable outcome rather than a fatal failure. `status: "failed"` is reserved strictly for invalid inputs (empty job description, invalid days parameter) or complete LLM failure.

---

## D7. Duplicate Submissions

- **Decision:** Compute an idempotency hash using SHA-256 of the normalized job description (trimmed, whitespace collapsed, lowercase), normalized company URL, days value, and user ID.
  - Active Generation: If a job with the same hash is currently running, attach to and return the running job.
  - Completed Kit: Return the existing kit with an option in the UI to create a fresh copy.
  - Same Posting Different Days: Re-use cached crawl results (valid for 24 hours) while generating a new schedule.

---

## D8. State Model for Builder & Regeneration

- **Decision:** Every question and flashcard maintains tracking flags:
  - `id`: Unique, stable identifier.
  - `origin`: `generated`, `user`, or `fallback`.
  - `edited`: Boolean, set to true upon any content edit or category move.
  - `pinned`: Boolean, toggled by user to prevent replacement.
- **Replaceable Condition:** An item is replaceable only when `origin === "generated" && !edited && !pinned`.
- **Merge-Time Protection:** The replaceable set is calculated at merge time against the latest database record, ensuring edits made while regeneration is in-flight are never overwritten.
- **API Granularity:** All builder actions utilize per-item and per-operation endpoints (`PATCH /api/kits/:id/questions/:qid`, `POST /api/kits/:id/reorder`, `POST /api/kits/:id/regenerate`) rather than destructive full-kit PUT operations.

---

## D9. Practice Ordering and Rating

- **Decision:** Practice queue uses a confidence-weighted sort:
  1. Unseen flashcards first.
  2. Lowest confidence rating first (1 to 5 scale).
  3. Oldest last-seen timestamp first.
  4. Original kit order.
- **Reason:** Direct, transparent prioritization addressing user-reported weak spots without unnecessary spaced-repetition calculation fragility.
- **Keyboard Access:** Spacebar reveals answer outline; numeric keys 1 through 5 record confidence rating.

---

## D10. Creative Feature: Diagnostic Weak-Spots & Adaptive Re-Planner

- **Decision:** Implement a deterministic "Weak-Spots Diagnostic Report" coupled with an "Adaptive Schedule Re-Planner".
- **Reason:** Connects flashcard practice metrics back to requirements via `requirement_ids`. Highlights critical must-have requirements where the user has low confidence or zero practice, and provides a one-click re-planner that recalibrates the remaining days to prioritize those gaps without inventing content.

---

## D11. Session Authentication and Deployment Proxy

- **Decision:** Session authentication using random session IDs stored in MongoDB with TTL indexing and delivered via httpOnly, Secure, SameSite cookies.
- **Production Architecture:** Configure Next.js rewrites proxy so that requests to `/api/*` on the frontend domain forward to the backend service. This eliminates cross-domain third-party cookie blocking.

---

## D12. Crawl Budget and Scope Safety

- **Decision:** Crawl budget capped at 10 pages maximum, depth 2, 10-second timeout per page, 1.5 MB response stream cap, per-host polite delays (~1 request per second).
- **Scope Restriction:** Scope restricted strictly to the starting origin and same URL path prefix (e.g. `http://localhost:8099/acme/` will not crawl `/globex/`). Includes `sitemap.xml` parsing.
- **Prompt Trimming:** Extracted text is capped at 6,000 characters per page and 20,000 characters total across all pages before feeding prompts.

---

## D13. Error and Warning Codes

- **Decision:** Standardized structured error codes across pipeline and API:
  - Warnings: `COMPANY_UNREACHABLE`, `COMPANY_URL_INVALID`, `NO_HIRING_PAGE`, `THIN_JOB_DESCRIPTION`, `NO_PUBLIC_DISCUSSION`, `MUST_COVERAGE_FALLBACK`, `FLASHCARDS_DERIVED`, `SCHEDULE_OVER_CAPACITY`.
  - Errors: `INVALID_INPUT`, `UNAUTHENTICATED`, `SESSION_EXPIRED`, `NOT_FOUND`, `LLM_UNAVAILABLE`, `EXTRACTION_FAILED`, `CASE_TIMEOUT`.

---

## D14. Deterministic Question-Count Planner

- **Decision:** Implement a deterministic planner function before question generation:
  - Technical: 2 questions per `must`, 1 per `nice` (cap 12).
  - Behavioural: 2 questions per `must`, 1 per `nice` (cap 8).
  - System Design: 3 questions if a system design interview round is discovered or role seniority is senior/staff/lead with technical requirements; otherwise 0.
  - Company Fit: 2 to 3 questions grounded in the company brief.
- **Reason:** Proves that interview process research directly and deterministically impacts kit generation.

---

## D15. Requirement IDs for Company-Fit Questions

- **Decision:** Company-fit questions prefer linking to behavioural or domain requirements. If no requirement fits, empty `requirement_ids: []` is permitted and accepted by the schema validator.

---

## D16. Schedule Allocation Algorithm & Extreme Day Counts

- **Decision:**
  - Day minutes: sum of question minutes (difficulty 1 = 10m, difficulty 2 = 15m, difficulty 3 = 20m).
  - When `Q >= N`: Guarantee 1 question per day, distribute remaining questions with weight `2N - d + 1` (front-loading harder items).
  - When `Q < N` (more days than questions): Days 1 to Q receive one question in priority order; days Q+1 to N become review days cycling through hardest questions at half minutes with focus prefixed by `Review:`.
  - When `N = 1`: Retain all questions on day 1 (no dropped questions) and attach `SCHEDULE_OVER_CAPACITY` warning if total minutes exceed 240.
  - When `Q = 0`: Allocate empty days with placeholder focus and warning.

---

## D17. Undo and Section Snapshots

- **Decision:** Before executing a section regeneration, the server records an immutable snapshot of the affected section, providing an instant one-click Undo action if the user prefers their prior state.

---

## D18. Frontend Visual Design

- **Decision:** Dark aesthetic theme with heavy inspiration from [interviewing.io](https://interviewing.io) as a reference. The app must look modern and polished — this is a signal of craft, not just functionality.
- **Locked choices (YOU — approved 21 Sep 2026):**
  - **Accent colour: Teal.** CSS variable `--accent: #14b8a6` (Tailwind `teal-500`). Hover: `#0d9488` (teal-600). Use for primary buttons, active tab indicators, focus rings, and inline links.
  - **Font: Inter.** Single font family for both headings and body. Load via `next/font/google`. Heading weight 700, body weight 400, UI labels weight 500. Fallback stack: `system-ui, sans-serif`.
  - **Layout:** Sidebar-and-content split for authenticated pages (matching interviewing.io's app shell). Marketing/auth pages use a centered column layout.
- **Fixed constraints:**
  - Background: near-black `#0a0a0f`. Never pure black.
  - Surface cards: `#13131a` with a `1px solid #1e1e2e` border.
  - Text: primary `#e2e8f0` (slate-200), secondary `#64748b` (slate-500), muted labels `#334155` (slate-700).
  - Minimum contrast 4.5:1 everywhere. Test with browser DevTools.
  - All interactive states (hover, focus, active) must be visible in the dark theme.
  - Tailwind CSS only. No inline styles, no CSS-in-JS other than Tailwind utilities and `@layer`.
- **Consequence in code:** `packages/web/src/app/globals.css` defines these CSS variables under `:root`. `tailwind.config.ts` extends the theme with `teal` accent and the above neutral scale. Inter loaded in `packages/web/src/app/layout.tsx` via `next/font/google`. A `ThemeProvider` is not needed — the app is always dark.
- **Consequence in README:** One screenshot showing the kit viewer page in the dark theme.
- **Date and who approved:** 21 Sep 2026, user confirmed.

---

## D19. Mock Feature Design Principle

- **Decision:** The mock interview feature (improvement loop — see D22) must rely on data and code as its primary mechanism. AI generation is used sparingly and only where deterministic logic cannot produce the same quality result.
- **What this means in practice:**
  - Timer, confidence tracking, session ordering, and debrief recording are all deterministic code with no model calls.
  - Question selection for a mock is deterministic: select from the kit's own questions filtered by the debrief's weak spots and gaps.
  - A model call is only permitted for the pre-interview mock scoring step (D22), and only if the core is done by Wednesday 16:00.
  - If AI is called, it must receive validated structured input (the user's written answer + the reference outline) and return a structured score, not free-form text. Schema-validated before use.
- **Reason:** Keeps the mock testable, reproducible, and fast. Prevents the feature from becoming a liability if LLM quota runs out. The brief credits deterministic design.

---

## D20. Deployed Demo Job Site

- **Decision:** Build and deploy a small static site serving fictional company careers pages alongside the main app. Recommended: deploy it to the same platform (for example Render or Railway static site, or a Vercel sub-path), so it is always reachable without a separate domain.
- **Why:** The batch CLI's 5-case test and the end-to-end fixture test need a real crawlable HTTP server. Using the deployed demo site means the clean-clone test does not require `localhost` and the grader can reproduce results without running a local server.
- **Minimal spec (build this before the clean-clone test on Tuesday):**
  - At least 3 fictional companies, each with a root page, an About page and a Careers page with 2–3 realistic-looking job posting links.
  - One company has no Careers page (tests `NO_HIRING_PAGE`).
  - One company's robots.txt disallows `/careers/` (tests robots compliance).
  - Plain HTML and CSS only, no build step.
- **Consequence in code:** Add the deployed demo URLs to `test/fixtures/cases.json` (cases 3–5). Add a `DEMO_SITE_BASE_URL` env var so the URL can be changed without editing fixtures.
- **Consequence in README:** Document the demo site and link to it.

---

## D21. Data Sources Without LinkedIn and Glassdoor

- **Decision:**
  - Primary public discussion source: Hacker News Search API (Algolia, already in D3). Free, no credentials, structured JSON.
  - Secondary: a **pasted-notes field** in the create-kit form. The user can paste raw text from any source they trust (LinkedIn comments, Glassdoor snippets copied manually, recruiter emails). This text is treated as an additional source, wrapped with `wrapUntrusted`, and fed into the discussion summary prompt.
- **Why not scrape LinkedIn or Glassdoor:** Both block automated access and violate terms of service. A paste field gives the user access to those sources without the app scraping them.
- **Field spec:** Optional textarea in `CreateKitForm`, label "Paste any interview notes or Glassdoor/LinkedIn snippets (optional)". Character limit 4,000. Stored as `extra_notes` in the kit input (extension field, listed in this document). Passed to `extractProcess` as an additional source with `label: "user-notes"`.
- **Consequence in schema:** Add `extra_notes?: string` to the kit input type (extension field).
- **Consequence in README:** List "Hacker News Search API (Algolia)" and "user-pasted notes" as sources. Explain why LinkedIn and Glassdoor are not scraped.

---

## D22. Improvement Loop (Creative Feature Decision)

- **Decision:** Build the improvement loop as the creative feature if the core is complete by Wednesday 16:00. Skip it otherwise and say so in the README.
- **Design principle:** D19 applies. Data and code first; AI sparingly.
- **Three parts:**

  **Part 1 — Debrief log:**
  After a real interview, the user records: the questions asked, their own answers (written, not audio), where they stumbled (confidence 1–2 on that question), and where their confidence dipped. Stored as a `Debrief` document linked to the kit.

  **Part 2 — Upsolve mock:**
  Code generates a targeted mock from the debrief. Questions where confidence dipped or stumbles were recorded are surfaced first. The mock runs with a configurable per-question timer (written answer, no audio). After answering, the user rates their confidence again. This is the "upsolve" loop — like reworking a contest problem you got wrong.

  **Part 3 — Pre-interview mock:**
  A full timed run through the kit's questions, ordered by the improvement loop's confidence data and the schedule's priority order. Scored from data: coverage of must-have requirements, average confidence, improvement delta since the debrief. No model scoring unless the core is done with time to spare.

- **Condition for building:** Core complete (schema, extraction, generation, coverage, schedule, CLI batch, auth, deploy) AND Wednesday 16:00 has not passed.
- **Consequence in code:** New route `/kits/[id]/debrief` and `/kits/[id]/mock`. New server collection `debriefs`. Pure ordering and scoring functions in `packages/core/src/mock/`.
- **Consequence in README:** Two to three sentences on why you built it and what problem it solves.

---

## D23. Answer Format for Mock Questions

- **Decision: Written answer + per-question countdown timer + self-rated confidence (confirmed 21 Sep 2026).**
- **Spec:**
  - Textarea for the written answer, visible throughout the question. No character minimum, no character maximum.
  - Per-question countdown timer, user-configurable before the session starts. Default 3 minutes. When the timer reaches zero, the answer textarea is locked and the reveal button activates automatically.
  - After the timer fires or the user clicks Reveal, the kit's reference answer outline appears below the textarea.
  - User rates their confidence (1–5) using visible buttons or keyboard keys 1–5. Required before advancing.
  - Timer state and written answers are session-only — they live in component state and are discarded when the session ends. Only the confidence rating is persisted.
- **Why written, not audio/video:** The brief explicitly states that audio and video simulation are not credited. Written answers with a timer replicate the written take-home format used in many real processes and add genuine prep value without any risk of scope creep.
- **Date and who approved:** 21 Sep 2026, user confirmed.

---

## D24. Deployment Stack

- **Decision (approved 21 Sep 2026):**
  - **Frontend:** Vercel (Next.js, free hobby tier). Deploy `packages/web` from the monorepo root using Vercel's `rootDirectory` setting.
  - **Backend API:** Render free tier (Node.js web service). Deploy `packages/server`. Note: Render free instances spin down after 15 minutes of inactivity — first request after idle takes ~30 seconds. Add a note in the README so graders expect this.
  - **Database:** MongoDB Atlas free tier (M0, 512 MB). One shared cluster.
  - **Cookie / CORS strategy:** Next.js rewrites proxy (`/api/* → backend URL`) so cookies are first-party and no cross-domain SameSite issues arise.
  - **Environment variable pattern:** All secrets injected via platform dashboards. No `.env` file committed.
- **Consequence in code:** `packages/web/next.config.ts` adds a `rewrites()` that proxies `/api/:path*` to `BACKEND_URL`. `BACKEND_URL` is a Vercel env var pointing to the Render service URL.
- **Consequence in README:** Deployment section links both URLs and notes the Render cold-start delay.

---

## D25. App Name

- **Decision: PrepMe (approved 21 Sep 2026).**
- **Usage:** Page title (`<title>PrepMe</title>`), favicon alt, `og:site_name`, README H1. All lowercase `prepme` for package names and slugs if needed.

---

## D26. Registration Fields

- **Decision: Email + password only (approved 21 Sep 2026).**
- **No display name.** The app is single-user in spirit — it is used solo for interview prep, not a social tool. A display name adds a field to validate and store with no UX benefit.
- **Consequence in code:** `users` MongoDB collection: `{ _id, email (unique, lowercase), passwordHash, createdAt }`. No `name` field. The UI shows the user's email in the header.
- **Consequence in README:** One-line note: "Registration requires only email and password."

---

## D27. Bulk Upload Row Limit

- **Decision: 10 rows maximum per upload (approved 21 Sep 2026).**
- **Reason:** 10 cases × ~12 LLM calls = ~120 calls per bulk run. This stays safely within the Gemini free tier of ~500 RPD. Beyond 10, a single upload would risk exhausting the daily quota before the run completes.
- **Consequence in code:** Server validates `body.length <= 10` and returns `{ error: { code: "TOO_MANY_CASES", message: "Maximum 10 job descriptions per upload." } }` for larger arrays. The frontend shows the limit in the upload label.

---

## D28. Input Character Limits

- **Decision (approved 21 Sep 2026):**
  - Job description (`jd`): maximum **20,000 characters**. A typical JD is 2–5K. 20K covers even the most verbose postings. The prompt trimmer (D12) caps what is sent to the LLM at 6K regardless, so this is purely a UI validation guard.
  - Pasted notes (`extra_notes`): maximum **4,000 characters** (D21).
  - Company URL: maximum **2,048 characters** (standard URL length limit).
  - Days: integer, minimum 1, maximum 60.
- **Consequence in code:** Zod schemas in `BatchCaseInputSchema` and the server's create-kit route enforce these limits and return `INVALID_INPUT` with a specific message for each violation.

---

## D29. Session TTL

- **Decision: 7 days (approved 21 Sep 2026).**
- **Reason:** Users prep over multiple days. A 24-hour TTL would interrupt mid-prep. 7 days matches common web app conventions and the 4-day assignment timeline.
- **Consequence in code:** MongoDB `sessions` collection has a TTL index on `expiresAt` set to `Date.now() + 7 * 24 * 60 * 60 * 1000`. The cookie `maxAge` is set to the same value.

---

## D30. Demo Job Site Hosting

- **Decision: Vercel, as a separate Vercel project (approved 21 Sep 2026).**
- **Reason:** Always up, instant deploys, free forever for a static HTML site, no cold-start delay. A separate project keeps the demo site URL independent of the main frontend deploy.
- **Spec (build before Tuesday clean-clone test):**
  - Plain HTML + CSS, no build step. Deployable from a `demo-site/` folder in the repo root.
  - 3 fictional companies: `NexusAI`, `PetalHealth`, `OrbitSystems`.
    - `NexusAI`: root + About + Careers page with 2 job links. Normal crawl.
    - `PetalHealth`: root + About only. No Careers page → tests `NO_HIRING_PAGE`.
    - `OrbitSystems`: root + About + Careers, but `robots.txt` disallows `/careers/` → tests robots compliance.
  - Add `DEMO_SITE_BASE_URL` env var. Default to the Vercel URL in `.env.example`.
- **Consequence in code:** `test/fixtures/cases.json` cases 3–5 use `DEMO_SITE_BASE_URL/nexusai/`, `/petalhealth/`, `/orbitsystems/`.
