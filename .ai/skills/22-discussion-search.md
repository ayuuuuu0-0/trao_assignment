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

## Done when
- The none_found and failed paths are tested and never stop the pipeline.
- The relevance filter is code and is tested with hits that should and should not pass.
- The sources used and rejected are recorded for the README.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
