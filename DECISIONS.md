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
- **Open (YOU — decide before building frontend):**
  - Accent colour: not yet chosen. Candidates: electric blue, teal, violet. Pick one and note it here.
  - Font: not yet chosen. Candidates: Inter, Geist, Sora. Pick a heading and a body font.
  - Layout density: card-based with clear dark panels and subtle borders, or a sidebar-and-content split like interviewing.io.
- **Fixed constraints:**
  - Background: near-black (for example `#0a0a0f` or `#0d0d14`), never pure black.
  - Surface cards: slightly lighter dark (for example `#13131a`), 1 px border in muted colour.
  - Text: off-white primary, muted secondary (never pure white on pure black).
  - Minimum contrast 4.5:1 everywhere. Test with browser DevTools.
  - All interactive states (hover, focus, active) must be visible in the dark theme.
  - Tailwind CSS only. No inline styles, no CSS-in-JS other than Tailwind utilities and `@layer`.
- **Consequence in code:** `packages/web/src/app/globals.css` defines a dark-mode-first CSS variable set. `tailwind.config.ts` extends the palette with the chosen accent and neutral scale. A `ThemeProvider` is not needed — the app is always dark.
- **Consequence in README:** One screenshot showing the kit viewer page in the dark theme.
- **Date and who approved:** YOU — fill in after choosing accent and fonts.

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

- **Status: YOU — not yet decided.**
- **Context:** The brief says audio and video simulation are not credited. Written answers with a timer are the only format that adds value without incurring build risk.
- **Recommendation:** Written answers with a per-question countdown timer (user-configurable, default 3 minutes). The answer is saved locally in the session only (not persisted), and the user rates their own confidence after reading the reference outline.
- **Options:**
  - Written answer + timer + self-rated confidence (recommended).
  - Timer only, no answer box (less friction, less value).
  - No timer, just a reveal and rating (same as current flashcard mode — not differentiated enough to count as a distinct feature).
- **Decision and defence:** Fill this in before building D22.
