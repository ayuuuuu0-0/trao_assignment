---
name: automated-tests
load_when: writing or reviewing tests
depends_on: [00-rules]
related: [10-kit-schema, 34-coverage, 35-schedule, 50-kit-ops]
code: packages/*/test
---

# Automated tests

## 9. Automated tests (required)

The brief names three areas: schedule allocation, coverage checking and structure validation. Add the others below because they protect the points that matter most.

Use a test runner such as Vitest or Jest. Inject a fake LLM client so every test runs offline in seconds.

| Area                        | Tests to write                                                                                                                                                                                    | Owner                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Schedule (6.12)             | N = 1, 2, 5, 14, 60. Q > N, Q = N, Q < N, Q = 0. Day count, no empty day, all must ids present, ids exist, integer minutes, hard-first, repeatable output                                         | **GUIDE** the agent with this list first |
| Coverage (6.11)             | No gaps. One gap. Gap for a `must`. Ids in questions that do not exist. Repair loop closes a gap with a fake LLM. Fake LLM returns bad ids twice, then the fallback fires and `passes` is correct | **GUIDE**                                |
| Structure validation (6.14) | Valid kit passes. Missing field. Bad requirement reference. Bad schedule reference. Float `minutes`. `difficulty` 4. Wrong `priority` value. Duplicate id. Day count mismatch                     | **GUIDE**                                |
| Extraction (6.6)            | Grounding drops an invented requirement. Priority override under a "Nice to have" heading. Dedup. Thin detection. Injection fixture                                                               | **GUIDE**                                |
| Security (6.2, 6.5)         | Blocked ranges including IPv6 and mapped addresses. Redirect to a private address. Content-type and size limits. Injection in a page                                                              | **GUIDE**                                |
| Kit operations (7.6)        | Edit survives regeneration. Pinned survives. New ids are new. Dangling schedule ids removed. Edit during regeneration                                                                             | **GUIDE**                                |
| Ownership (6.1)             | User A cannot read, update, delete or regenerate user B's kit                                                                                                                                     | **GUIDE**                                |
| Batch (6.16)                | A 3-case file with one failing case writes 3 entries. Output matches Appendix B shape                                                                                                             | **GUIDE**                                |

- **AGENT**: write and run them.
- **YOU**: confirm each important test can fail. Break the code on purpose once (for example return an off-by-one day count) and watch the test go red. Tests that cannot fail protect nothing.

## Done when
- Every suite in the table exists and npm run check passes.
- Each important test was seen failing once when the code was broken on purpose.
- No test uses the network or a real key.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
