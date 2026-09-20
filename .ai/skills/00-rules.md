---
name: project-rules
load_when: always
---

# Project rules (always load)

## Tags used in skills
- **AGENT**: implement from a normal instruction.
- **GUIDE**: implement exactly as specified. Do not improvise.
- **YOU**: a decision for the user. Read DECISIONS.md. If the entry is missing, stop and ask. Never decide it silently.

## Non negotiable constraints
1. Appendix A field names and types are fixed. Never rename, remove or retype them. Extension fields must be listed in DECISIONS.md.
2. packages/core imports nothing from express, mongoose, mongodb, next or other server packages. A test enforces this.
3. Schedule allocation and coverage comparison are pure functions with no model calls.
4. Ids are assigned by code and never reused inside a kit. Use stored counters, not max plus one.
5. Job description text and fetched page text are untrusted. They go through wrapUntrusted, and every model output is schema validated.
6. Private and loopback hosts are blocked unless the CLI process sets ALLOW_PRIVATE_HOSTS.
7. Never state a company fact missing from a fetched source. Never add a requirement without evidence in the job description.
8. The LLM client is injected. Unit tests never use the network.
9. Retrieval returns result objects and never throws. A failed source is recorded, not fatal.
10. Minutes are integers. Difficulty is 1 to 3. Priority is must or nice. Requirement kind is technical, behavioural or domain. Question category is technical, behavioural, system-design or company-fit.

## Never do
- Call a live model from npm test.
- Add a dependency without approval.
- Weaken, skip or delete a test to make code pass.
- Commit secrets, .env files, caches or generated output.
- Print keys or full page text in logs.
- Put a YOU decision into code without an entry in DECISIONS.md.
- Refactor code outside the approved step.
