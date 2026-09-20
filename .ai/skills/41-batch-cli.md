---
name: batch-command-and-edge-cases
load_when: implementing or testing npm run evaluate, or handling an edge case
depends_on: [00-rules, 30-llm-client, 10-kit-schema]
related: [20-safe-fetch, 40-jobs-duplicates]
code: packages/cli/src/evaluate.ts
---

# Batch command and edge cases

## 3.3 Batch command (Section 9)

```
npm run evaluate -- --input <cases.json> --output <kits.json>
```

Input, an array of cases:

```json
[
  {
    "id": "case-01",
    "jd": "Senior Backend Engineer ...",
    "company_url": "http://localhost:8099/acme/",
    "days": 5
  }
]
```

Output, one entry per input case:

```json
{
  "version": "1.0",
  "generated_at": "2026-09-01T09:12:44Z",
  "kits": [
    { "id": "case-01", "status": "ok", "kit": {}, "error": null },
    {
      "id": "case-04",
      "status": "failed",
      "kit": null,
      "error": { "code": "COMPANY_UNREACHABLE", "message": "..." }
    }
  ]
}
```

Requirements for the command:

- Runs the same retrieval, generation and validation code as the web app, not a parallel copy.
- Uses each case's own `days` value.
- Continues after a failed case and records the failure.
- Finishes 5 cases within 15 minutes, including retries forced by rate limits.
- Reads credentials from environment variables documented in `.env.example`.
- Needs nothing beyond your documented install step. It runs from a clean clone.
- Company sites may be served from a local address, so retrieval cannot assume a host and must follow relative links.

## D6. Outcome when the company site cannot be reached

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

## 6.16 Batch entry point (mandatory, automated scoring)

- **AGENT**: the CLI wrapper, argument parsing (`--input`, `--output`), writing the output file.
- **GUIDE (spec)**:
  - The CLI calls `runPipeline` from `core`. It imports no Express or MongoDB code.
  - Read the array, validate each case, run cases one after another (or 2 at a time, through the shared limiter), wrap each in `try/catch`.
  - Give each case its own time budget, for example 150 seconds. Five cases at 150 seconds is 12.5 minutes in the worst case, which stays inside 15. A slow case then fails with `CASE_TIMEOUT` and cannot use the whole run.
  - Write the output file even if every case failed, and rewrite it after each case, so a crash still leaves partial results.
  - Set `ALLOW_PRIVATE_HOSTS=true` inside the CLI process before calling the pipeline.
  - Print one progress line per case to stderr. Print no secrets.
  - Exit code 0 when the file was written.
- **YOU (D6, D13)**: the error codes and the ok-versus-failed rule.
- **Test yourself (do this on day 4, at the latest)**: clone into a fresh folder, follow only the README, install, set the environment, and run the command on a 5-case file containing a normal posting against a local site, a dead URL, a two-line job description, a site with no hiring page and a case with `days: 1`. Check the output file against the structure with your own validator.

## 6.17 Edge case checklist

Write the expected behaviour in one line each in the README, and one test or fixture for each row.

| #   | Case                                            | Expected behaviour                                         | Kit outcome                                                                |
| --- | ----------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | Company URL invalid, 404 or times out           | Record the failure, continue with the job description only | `ok`, warning `COMPANY_UNREACHABLE` or `COMPANY_URL_INVALID`, honest brief |
| 2   | No hiring or about page found                   | Report it, questions use the default plan                  | `ok`, warning `NO_HIRING_PAGE`                                             |
| 3   | Two-line job description                        | Extract only what is stated, no padding                    | `ok`, warning `THIN_JOB_DESCRIPTION`, small kit                            |
| 4   | Public discussion finds nothing                 | Say so in the brief and process block                      | `ok`, warning `NO_PUBLIC_DISCUSSION`                                       |
| 5   | Model returns invalid JSON or an incomplete kit | Retry once, then use the step's fallback                   | `ok` or `failed` only if extraction cannot succeed                         |
| 6   | Provider rate-limits or fails briefly           | Backoff, retry, respect `Retry-After`                      | `ok`, or `failed` with `LLM_UNAVAILABLE` after all attempts                |
| 7   | Same description and company submitted twice    | Return the running job or existing kit (D7)                | No second generation                                                       |
| 8   | 1-day and 60-day schedule                       | Exactly N days, no dropped questions (6.12)                | `ok`, maybe `SCHEDULE_OVER_CAPACITY`                                       |
| 9   | robots.txt disallows a page                     | Skip it, record `ROBOTS_DISALLOWED`                        | `ok`                                                                       |
| 10  | Page contains an injection string               | Treated as data (6.5)                                      | No effect on the kit                                                       |
| 11  | Company page is a PDF, image or 5 MB HTML       | Rejected by content-type or size                           | Page recorded as skipped                                                   |

- **AGENT**: fixtures and tests once you name the behaviour.
- **YOU**: the behaviour column, which is your list of decisions.

## Done when
- A fresh clone follows only the README, installs and runs the command on a 5-case file with a normal case against a local site, a dead URL, a two-line job description, a no-hiring-page site and days = 1.
- The output file has one entry per case, matches Appendix B and every kit passes validateKit.
- One failing case does not stop the run. The file is rewritten after every case.
- ALLOW_PRIVATE_HOSTS is set only inside the CLI process.
- The real wall clock time for 5 cases is recorded for the README.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
