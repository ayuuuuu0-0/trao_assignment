---
name: decisions-reference
load_when: writing or reviewing DECISIONS.md, or a step is tagged YOU and its entry is missing
depends_on: [00-rules]
related: [30-llm-client, 41-batch-cli, 50-kit-ops]
code: DECISIONS.md
---

# Decisions reference

## 4. Decisions you make before any code (all YOU)

Create `DECISIONS.md` and answer each item in writing. Every answer becomes a README section, and the agent needs most of them as input. For each decision the entry below gives the options, a recommendation and what to record.

### D1. Stack

- **Options**: preferred stack (Next.js, Tailwind, Express, MongoDB) or an equivalent with a written justification.
- **Recommendation**: the preferred stack, in TypeScript, as an npm workspaces monorepo. No justification is needed, and you avoid spending README space defending a deviation.
- **Constraint to plan for**: `npm run evaluate` runs from the repository root and must work after your documented install step. Use a runner such as `tsx` in the script, or build inside the script. A separate manual build step counts as extra setup.
- **Record**: stack, language choice, repo layout.

### D2. LLM provider and model

- **Criteria**: a real free tier, JSON output mode or structured output support, a context window of at least 16k tokens, free-tier limits that fit your call budget (see 6.13), and a signup that works from your own country.
- **How to choose**: check the provider's current documentation for requests per minute (RPM), tokens per minute (TPM) and requests per day (RPD). Free-tier limits change. Then run 20 real calls with your real prompt sizes and record how many return 429 and the median latency.
- **Current recommendation (checked in September 2026, so verify before you rely on it)**:
  - **Primary**: Gemini Flash-Lite (`gemini-3.1-flash-lite` or `gemini-3.5-flash-lite`) on Google's free tier. Trackers list about 500 requests per day for the Flash-Lite models and about 20 per day for the larger Flash models. A 5-case batch needs roughly 40 to 60 calls, so a 20-per-day model cannot finish one run and must not be your default. One tracker lists 15 RPM and 250K TPM for 3.1 Flash-Lite. Read the real numbers for your project at aistudio.google.com/rate-limit and write them down.
  - **Fallbacks, ordered and all optional**: Mistral free mode first (no card, possible SMS verification, about 1 request per second reported, turn off training data sharing in the Admin Console under Privacy). GLM-4.7-Flash on the international z.ai endpoint second (email signup, 1 concurrent request, so run it with concurrency 1).
  - **Not usable for you or not free**: Alibaba Qwen (the international console ties your phone number to the country chosen at signup, and you found India is not offered), DeepSeek and Kimi (paid), OpenRouter free models (50 requests per day until you buy credits), Cerebras (a payment method is required before the credit works), Groq (free, but 8K tokens per minute, so suitable for small calls only).
  - **Data note**: free tiers can use your prompts for training (Gemini free tier, Mistral free mode by default). Say so in the README and never send private data through them.
- **Design for graders swapping keys**: the graders run your command with credentials from `.env.example`. Use an adapter with environment-driven settings (`LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_RPM`, `LLM_TPM`, `LLM_CONCURRENCY`). Many providers, including several with free tiers, offer OpenAI-compatible endpoints, which lets a grader change provider by changing environment values only. Confirm this for your provider.
- **Design for missing keys**: the fallback list is generic (numbered environment variables, see 5.4), never tied to one vendor. A missing fallback key means a single-provider run, never a crash.
- **Record**: provider, model, limits and the date you checked them, plus the ordered fallback list.

### D3. Source for public interview discussion

- **Requirement**: it must work from a script without a paid key, and it must degrade to "nothing found" without failing.
- **Candidates to test by hand before committing**:
  - The Hacker News search API (Algolia): free, no key, JSON. Check that it returns useful hits for a well-known company.
  - Reddit: unauthenticated script access is frequently blocked or limited, and the terms matter. Test it, do not assume.
  - A general search API with a free tier: needs a key, which adds an environment variable graders may not have.
  - Sites such as Glassdoor and LinkedIn: they generally block automated access and their terms restrict scraping. Do not build on them. The brief tells you to respect site terms.
- **Recommendation**: one keyless source as the default (test Hacker News first), and an optional second source that switches on only when its key is present. Record a skipped source in the kit's `research` block.
- **Relevance filter (code, not model)**: keep a hit only if the company name appears in its title or text and it contains an interview-related word (`interview`, `hiring process`, `take-home`, `onsite`, `recruiter`, `screen`).
- **Record**: sources used, why others were rejected, what happens on zero hits.

### D4. Coverage passes and stopping rule

- **Definition to fix**: `coverage.passes` counts coverage checks run, so the first check after the first draft is pass 1.
- **Recommendation**: at most 2 repair rounds after the first draft, so at most 3 checks. After the last round, any must-have still uncovered gets a deterministic fallback question built by code from the requirement text (see 6.11). Nice-to-have gaps that remain are listed in `uncovered_requirement_ids`.
- **Reasoning to write**: round one fixes omissions. Round two fixes a model that returned invalid ids or ignored the target. A third round rarely changes the outcome and costs 1 to 2 more calls per case. The fallback guarantees the rule that a kit never ships with an uncovered must-have.
- **Record**: the limit, the fallback, the meaning of `passes`.

### D5. Rules for must versus nice

The brief says priority comes from how the posting words it. Write the mapping down before you write the extraction prompt.

| Signal in the posting                                                                   | Priority                                                                                  |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Under a heading such as Requirements, Qualifications, What you need, Must have, Minimum | `must`                                                                                    |
| Words: required, must, need to, you will need, minimum, essential                       | `must`                                                                                    |
| Years-of-experience statements with no hedging ("5+ years of React")                    | `must`                                                                                    |
| Under a heading such as Nice to have, Bonus, Preferred, Plus, Extra credit              | `nice`                                                                                    |
| Words: bonus, nice to have, preferred, a plus, ideally, familiarity with, exposure to   | `nice`                                                                                    |
| No heading and no cue words                                                             | Your default. Recommended: `must` for concrete skills or years, `nice` for hedged wording |

Decide and record: the default, and how a line like "experience with Kubernetes is helpful" is handled.

### D6. Outcome when the company site cannot be reached

Appendix B shows an example entry with status `failed` and code `COMPANY_UNREACHABLE`. The FAQ says a partly researched case is `ok`, and reserves `failed` for a case where you could not produce a kit at all. The Robustness criterion says unreachable sites are "recorded rather than fatal".

- **My reading**: the FAQ is the specific rule and the Appendix B entry is a format example. If the job description is usable, you can build a kit from it, so the case is `ok` with the gap recorded in `warnings` and `research`.
- **Recommended outcome table**:

| Situation                                       | Status   | Recorded as                                                                                   |
| ----------------------------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| Company URL invalid, 404, timeout, blocked      | `ok`     | warning `COMPANY_UNREACHABLE` or `COMPANY_URL_INVALID`, brief says nothing could be retrieved |
| Site reachable, no hiring or about page found   | `ok`     | warning `NO_HIRING_PAGE`                                                                      |
| Job description empty or whitespace             | `failed` | `INVALID_INPUT`                                                                               |
| Days missing, not an integer or out of range    | `failed` | `INVALID_INPUT`                                                                               |
| LLM unavailable after all retries               | `failed` | `LLM_UNAVAILABLE`                                                                             |
| Extraction returns nothing usable after retries | `failed` | `EXTRACTION_FAILED`                                                                           |
| Case exceeds its time budget                    | `failed` | `CASE_TIMEOUT`                                                                                |

- **Risk**: this reading can cost points if the grader expects `failed` for a dead site. State the rule in the README. It follows the FAQ wording, which is the stronger evidence.

### D7. Duplicate submissions

The same description and company submitted twice.

- **Key**: SHA-256 of the normalised job description (trimmed, whitespace collapsed, lowercased), the normalised company URL, the days value and the user id.
- **Recommended behaviour**:
  - Same key with a job still running: return that running job. Do not start a second one.
  - Same key with a finished kit: return the existing kit with a message "You already have this kit" and offer a "Create a new copy" action that sets a `force` flag.
  - Same job description and URL with different days: this is a new kit, but reuse the cached crawl results for that URL (cache pages for a short time, for example 24 hours) so you do not re-fetch and re-clean.
- **Record**: the key, the three behaviours, the cache duration.

### D8. State model for generated, edited and pinned items

Design this yourself. The brief calls it the hardest state problem. The full recommended model is in 7.6. The decision to record here: which flags exist, what sets them, and what regeneration does with each.

### D9. Practice ordering

- **Options**: confidence-weighted sort, or a spaced-repetition interval scheme.
- **Recommendation for a 4-day timebox**: unseen cards first, then lowest last confidence, then oldest last-seen time, then kit order. A one-sentence defence: the user's stated confidence is the only signal you have, and the sort uses it directly with no interval maths to get wrong.
- **Record**: the sort key order and the rating scale (1 to 5 recommended).

### D10. Creative feature

Optional. Decide after the core works. See Part 8. Record yes or no and the feature name.

### Additional decisions to write down

| #   | Decision                                    | Recommendation                                                                                                                                                |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D11 | Session mechanism                           | Random session id in an httpOnly, Secure, SameSite cookie, stored in MongoDB with a TTL index. See 6.1 for the cross-domain issue.                            |
| D12 | Crawl budget                                | Max 10 pages, depth 2, 10 second timeout per request, 1.5 MB size cap, about 1 request per second per host.                                                   |
| D13 | Error and warning codes                     | See 6.16 and the list in D6.                                                                                                                                  |
| D14 | Which question categories to run            | Run all four calls, but let a category return an empty list when the material does not support it. Record it as skipped. See 6.9.                             |
| D15 | `requirement_ids` for company-fit questions | Prefer at least one id (for example a behavioural requirement). If none fits, allow an empty array and make your validator accept it. Decide and document it. |
| D16 | Schedule rules for extreme day counts       | See 6.12. Do not drop questions.                                                                                                                              |
| D17 | Undo for regeneration                       | Keep one snapshot of the section before each regeneration and offer "Undo".                                                                                   |

Template for `DECISIONS.md`:

```md
## D6. Unreachable company site

Decision: ...
Reason: ...
Consequence in code: ...
Consequence in README: ...
```

## Done when
- Every decision D1 to D17 has an entry in DECISIONS.md with options, choice, reason and consequence.
- The user has read and approved each entry. The agent proposes, the user decides.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
