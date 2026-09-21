---
name: discussion-search
load_when: implementing the public interview discussion search
depends_on: [00-rules]
related: [32-process-brief]
code: packages/core/src/retrieval/search.ts
---

# Discussion search

## 6.4 Searching public discussion

**Brief**: look for public discussion of the company's interview process. A run that finds nothing must still complete.

- **AGENT**: a `searchDiscussion(companyName)` function that calls the source you picked in D3, applies the relevance filter, and returns up to 5 snippets with URL and source name.
- **GUIDE**: run 2 queries at most (for example `"<company> interview"` and `"<company> hiring process"`). Apply the code filter from D3. Cap each snippet at 800 characters. Return `{ status: "found" | "none_found" | "failed", sources: [...] }`. A network failure returns `failed` with a reason, and the pipeline goes on.
- **YOU**: what the kit says when nothing is found. Recommended: the brief and the process block say "No public discussion of this company's interview process was found", and the questions use the default category plan.
- **Note**: a fictional company on a local address will return nothing. That is the expected honest result.

## D3. Source for public interview discussion

- **Requirement**: it must work from a script without a paid key, and it must degrade to "nothing found" without failing.
- **Candidates to test by hand before committing**:
  - The Hacker News search API (Algolia): free, no key, JSON. Check that it returns useful hits for a well-known company.
  - Reddit: unauthenticated script access is frequently blocked or limited, and the terms matter. Test it, do not assume.
  - A general search API with a free tier: needs a key, which adds an environment variable graders may not have.
  - Sites such as Glassdoor and LinkedIn: they generally block automated access and their terms restrict scraping. Do not build on them. The brief tells you to respect site terms.
- **Recommendation**: one keyless source as the default (test Hacker News first), and an optional second source that switches on only when its key is present. Record a skipped source in the kit's `research` block.
- **Relevance filter (code, not model)**: keep a hit only if the company name appears in its title or text and it contains an interview-related word (`interview`, `hiring process`, `take-home`, `onsite`, `recruiter`, `screen`).
- **Record**: sources used, why others were rejected, what happens on zero hits.

## D21. Data sources without LinkedIn and Glassdoor

- **Hacker News Search API (Algolia)** is the primary public discussion source (already in D3). Free, no credentials, structured JSON.
- **Pasted-notes field** (`extra_notes`): an optional textarea in `CreateKitForm` where the user pastes raw text from anywhere — LinkedIn comments copied manually, Glassdoor snippets, recruiter emails.
  - Field label: "Paste any interview notes or Glassdoor/LinkedIn snippets (optional)". Character limit 4,000.
  - Passed to `extractProcess` as an additional source: `{ label: "user-notes", text: extra_notes }`.
  - Must go through `wrapUntrusted` before entering any prompt. Never interpolated raw.
  - Stored as `extra_notes?: string` in the kit input (extension field, listed in DECISIONS.md D21).
- **Why not scrape LinkedIn or Glassdoor:** both block automated access and violate terms of service. The paste field lets the user bring those sources in without the app scraping them.
- In the README, list "Hacker News Search API (Algolia)" and "user-pasted notes" as sources. One sentence explaining why LinkedIn/Glassdoor are not scraped.

## Done when
- The none_found and failed paths are tested and never stop the pipeline.
- The relevance filter is code and is tested with hits that should and should not pass.
- The sources used and rejected are recorded for the README.
- `extra_notes` is passed through `wrapUntrusted` and appears in the discussion summary prompt when present.
- An empty `extra_notes` (absent or blank) produces the same output as before.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
