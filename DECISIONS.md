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
  - Primary Provider: Gemini 3.1 Flash-Lite (or Gemini 3.5 Flash-Lite) via Google AI Studio API. Model name configured via `LLM_MODEL`. Generous free tier (~500 RPD vs 20 RPD on 2.5 Flash-Lite).
  - Optional Fallback Provider: Qwen Flash / Qwen Plus via Alibaba DashScope OpenAI-compatible endpoint.
  - Optional Fallback Resilience: The system functions as a robust single-provider pipeline if no fallback key is configured.
  - Rate Limit Discrimination: Distinguish per-minute 429 errors from daily-quota 429 errors:
    - Per-minute 429: Apply `Retry-After` header or exponential backoff with random jitter.
    - Daily-quota 429: Fail over immediately to fallback provider or surface quota exhaustion without delay.
  - Circuit Breaker: If a provider fails N consecutive times (default 3), trigger a cooldown window skipping subsequent calls to that provider.
  - Call Tracing: Record provider identity (`gemini` or `qwen`), token estimates, and latency on each call trace.
  - Schema Truth: Zod schemas in `packages/core` remain the single source of truth for runtime validation across all providers.
  - Development Cache: Include a development-only cache (`LLM_CACHE=true`) keyed by prompt hash to conserve API quotas during local test iterations.
- **Reason:** Prevents pipeline crashes during automated multi-case evaluation, respects free-tier constraints, and ensures transparent operational observability.

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
