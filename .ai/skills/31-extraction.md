---
name: requirement-extraction
load_when: implementing or changing requirement extraction, must or nice rules, thin detection
depends_on: [00-rules, 23-prompt-safety, 30-llm-client]
related: [10-kit-schema]
code: packages/core/src/steps/extractRequirements.ts
---

# Requirement extraction

## 6.6 Requirement extraction (20 points)

**Brief**: extract the relevant requirements, id each one, mark it `must` or `nice` from how the posting words it. "Inventing requirements a description does not contain is worse than reporting that there were few."

- **AGENT**: the extraction step, the JSON parsing, a schema check.
- **GUIDE (prompt spec)**:
  - Return `title`, `seniority`, `location`, `company` (only if stated), `responsibilities[]` and `requirements[]`. Use `""` for anything the posting does not state.
  - Each requirement has `text` (short, one testable claim), `kind`, `priority` and `evidence`, where `evidence` is a verbatim copy of the sentence or line from the posting.
  - Put the D5 mapping in the prompt with examples for each row. Include one example with a "Nice to have" section and one with an unmarked list.
  - Responsibilities ("You will design APIs") go in `responsibilities`. Requirements ("You have 5 years of Node") go in `requirements`. Do not double-list.
  - Kind mapping: `technical` for languages, tools and concepts, `behavioural` for mentoring, communication and ownership, `domain` for industry knowledge such as fintech or healthcare compliance.
  - Instruct the model to return fewer items when unsure, and never to add requirements that the posting does not state.
  - Ids are not the model's job. Code assigns `r1`, `r2`, ... in order of appearance.
- **GUIDE (deterministic checks, run after the model)**:
  1. **Grounding**: normalise whitespace, case and punctuation in the job description and in each `evidence` string. Drop any requirement whose evidence is not found in the job description. This is the direct protection for the "nothing invented" score.
  2. **Priority override**: find the evidence's position in the job description, look back for the nearest heading line, and apply the D5 mapping. A line under "Nice to have" is `nice` even if the model said `must`. A line containing "required" or "must" is `must`.
  3. **Deduplicate**: merge requirements with identical normalised text or very high word overlap.
  4. **Cap**: keep at most about 25 requirements, must-haves first.
  5. **Thin detection**: if the description is under 300 characters or yields fewer than 3 requirements, add warning `THIN_JOB_DESCRIPTION` with the actual counts.
- **YOU (D5)**: the default priority and the atomicity rule. Decide whether "React, Vue or Angular" is one requirement (recommended, since it is one alternative list) and whether "Node, Postgres and Redis" becomes three (recommended when they are separate skills). Write two examples in `DECISIONS.md`.
- **Test yourself**: write 5 job descriptions by hand: a full posting with a clear "Bonus" section, a posting with no headings, a two-line stub, a posting where responsibilities are long and requirements are short, and a posting that contains an injection string. Check the output line by line against what you know is in each.

## D5. Rules for must versus nice

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

## Done when
- Five hand-written job description fixtures exist: full with a Bonus section, no headings, two-line stub, long responsibilities with short requirements, injection string.
- The grounding check drops an invented requirement in a test.
- The heading based priority override is tested.
- Ids are assigned by code, in order of appearance.
- THIN_JOB_DESCRIPTION is set with real counts.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
