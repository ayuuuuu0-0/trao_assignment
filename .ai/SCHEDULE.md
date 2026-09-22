# Schedule (load when planning a step or reporting progress)

## Deadline
- Brief received at 19:51 on Sunday 20 September 2026. Confirm the time zone on the email.
- Deadline: 19:51 on Thursday 24 September 2026. Treat it as a hard stop.
- Lateness note from the recruiter: 5% deducted at 24 hours late, 7.5% at 48, 10% at 72, and no promise of a review after 72. The brief also says the link expires at the deadline. Use lateness only as an emergency.
- Working target: everything built, tested and deployed by the night of Wednesday 23 September.
- Thursday: README, video, last clean-clone test, submit by about 14:00. Hard stop at 16:00.

## Daily exit criteria
| Day | Must be true by the end of the day |
|---|---|
| Mon 21 | DECISIONS.md updated (fallback list is Mistral then GLM, not Qwen). Commits split. AGENTS.md rules added. safeFetch, crawler, ranker, discussion search and extraction done with tests. Gemini key created and real limits recorded. |
| Tue 22 | Kit operations with tests. LLM client with fallback chain. All generation steps, coverage loop and scheduler. Real 5-case batch under 15 minutes, including a dead URL, a two-line job description and a no-hiring-page site. Clean clone passes. |
| Wed 23 | Auth, jobs, first deploy (right after auth), frontend, builder, practice mode. Feature freeze at 22:00. Keyboard-only run, 375 px check, phone test of the deployed app. |
| Thu 24 | README, video, second deploy check, final clean-clone test, submit by about 14:00. |

## Cut order if behind
Creative feature, bulk upload polish, drag and drop (keep the buttons), the optional coverage keyword check.
Never cut: coverage loop, deterministic schedule, grounding checks, batch command, honest handling of thin and no-hiring-page cases, state model tests.

## Progress log
| Date and time | Step | Status | Notes |
|---|---|---|---|
| Sun 20 Sep | Step 0 and Step 1 | Done | Decisions, monorepo, schema, validateKit, thin batch command, 11 tests |
| Mon 21 Sep | Step 2a safeFetch | Done | SSRF blocking, DNS pinning, redirects, content-type and size caps, 33 tests passing |
| Mon 21 Sep | Step 2b Crawler & LinkRanker | Done | Robots.txt, sitemaps, link scoring, path prefix scoping, 21 tests passing |
| Mon 21 Sep | Step 2c Discussion Search | Done | Hacker News Algolia search, relevance filter, degradation, 12 tests passing |
| Mon 21 Sep | Step 2d Requirement Extraction | Done | Grounding checks, D5 priority rules, prompt injection defense, 12 tests passing |
| Tue 22 Sep | Step 3a Kit Operations & State Model | Done | Pure operations, stored ID counters, merge-time category regeneration, 14 tests passing |
| Tue 22 Sep | Step 3b LLM Client & Fallback Chain | Done | Multi-provider chain, 429 daily quota discrimination, circuit breaker, dev cache, 8 tests passing |






