---
name: process-and-company-brief
load_when: implementing interview process extraction or the company brief
depends_on: [00-rules, 23-prompt-safety, 30-llm-client]
related: [21-crawler, 22-discussion-search, 33-questions-flashcards]
code: packages/core/src/steps/extractProcess.ts, companyBrief.ts
---

# Process and company brief

## 6.7 Interview process extraction

**Brief**: a hiring page, once found, changes what questions make sense. A company that publishes a take-home followed by a system design round should produce a different kit from one that says nothing.

- **AGENT**: the step and its schema.
- **GUIDE (spec)**: input is the cleaned text of pages labelled `hiring` plus discussion snippets. Output is `{ found, rounds: [{ name, format, detail, evidence, source_url }], notes }`, where `format` is one of `screen`, `coding`, `take-home`, `system-design`, `behavioural`, `panel`, `other`. Apply the same evidence rule as 6.6: drop any round whose evidence is not in the source text. Skip the model call and return `{ found: false }` when there is no hiring text and no discussion.
- **YOU**: how each format changes the kit. A concrete rule set to start from is in 6.9.

## 6.8 Company brief

**Brief**: an honest brief, not a fabricated one, when little or nothing is found.

- **AGENT**: the brief step.
- **GUIDE (spec)**:
  - Input: cleaned text of `about` and `other` pages, plus any company paragraph in the job description.
  - Output: `summary` (up to 120 words) and `what_they_do` (up to 80 words). Every statement must come from the supplied text.
  - `sources` lists the URLs of pages actually given to the model.
  - **When the usable text is under about 200 characters, skip the model.** Return a fixed honest brief: "No information about this company could be retrieved from <url>." If the job description has a company paragraph, add "The job description says: ..." as a quoted summary. This costs zero calls and cannot hallucinate.
- **Test (write it)**: run with an unreachable site and assert the brief contains no company facts beyond what the job description states.

## Done when
- With no usable text, the brief is deterministic and a test asserts zero model calls.
- A round without evidence in the source text is dropped.
- With an unreachable site, the brief contains no company facts beyond the job description.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
