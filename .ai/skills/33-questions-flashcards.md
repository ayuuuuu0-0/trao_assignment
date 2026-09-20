---
name: questions-and-flashcards
load_when: implementing question planning, per-category generation, or flashcards
depends_on: [00-rules, 23-prompt-safety, 30-llm-client, 32-process-brief]
related: [34-coverage]
code: packages/core/src/steps/planQuestions.ts, generateQuestions.ts, generateFlashcards.ts
---

# Questions and flashcards

## 6.9 Question generation by category

**Brief**: generate questions for a given requirement and category. Technical and behavioural requirements must not come from the same call with the same instructions.

- **AGENT**: one function per category, shared output parsing, deduplication.
- **GUIDE (step 1, deterministic plan)**: code computes how many questions each category gets, then passes that number to the prompt. Starting rules:

| Category        | Requirements fed to the call                 | Default count                      | Adjustment from process or seniority                                                                                              |
| --------------- | -------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `technical`     | `kind` = technical or domain                 | 2 per `must`, 1 per `nice`, cap 12 | If a take-home is published, add questions about walking through a design and defending trade-offs                                |
| `behavioural`   | `kind` = behavioural                         | 2 per `must`, 1 per `nice`, cap 8  | If a behavioural or values round is published, raise the cap and use the values text                                              |
| `system-design` | technical requirements plus responsibilities | 0                                  | 3 if a system-design round is published, or if seniority is senior, staff, lead or principal and at least 1 technical must exists |
| `company-fit`   | none, plus the brief                         | 2                                  | 3 if company pages were found                                                                                                     |

The counts are yours to change. What matters is that code decides them from what was found, which shows the sequencing responds to the research.

- **GUIDE (step 2, separate prompts)**: each category has its own system prompt.
  - `technical`: test knowledge and applied use of the given requirement. `answer_outline` is 3 to 6 short points.
  - `behavioural`: STAR-style prompts. The outline lists what a strong answer includes.
  - `system-design`: prompts with a scale or constraint. The outline lists components and trade-offs. Use only technologies named in the job description or pages.
  - `company-fit`: motivation and values prompts grounded in the brief. Never claim a fact about the company that the sources do not state.
  - Difficulty rubric for all: 1 recall, 2 applied use, 3 design, trade-offs or edge cases.
- **GUIDE (step 3, code owns the fields)**: the model returns `requirement_ids`, `prompt`, `answer_outline`, `difficulty`. Code sets `category` from the call, assigns ids `q1`, `q2`, ..., removes ids that do not exist in the requirement list, drops questions with no valid ids (except company-fit under D15), removes duplicate prompts, and rejects a `difficulty` outside 1 to 3.
- **GUIDE (empty results)**: a category may return `[]`. Record it in `research` as skipped with a reason. Do not pad with filler.
- **YOU (D14)**: whether to always run all four calls. Running all four is easier to defend against the "categories generated separately" check. A category that returns an empty list on a thin posting is honest.
- **Test (write it)**: a fake LLM that records prompts. Feed a fixture with a take-home plus system-design page and a fixture with no hiring page. Assert the two plans differ and that the prompts include the process notes only in the first case.

## 6.10 Flashcards

- **AGENT**: a flashcard step.
- **GUIDE**: input is the questions and the requirements. Front up to 140 characters, back up to 300. Each card references requirement ids from the list. Target about 10 to 30 cards, fewer for a thin kit. If the call fails twice, derive cards in code: front is the question prompt, back is the first 300 characters of the answer outline. Add warning `FLASHCARDS_DERIVED`.

## Done when
- The question plan is computed by code and differs between a fixture with a take-home plus system-design page and a fixture with no hiring page.
- A test with a recording fake client shows one call per category with different system prompts.
- Category, ids and requirement id filtering are set by code.
- A category that returns no questions is recorded as skipped.
- The flashcard fallback derives cards from questions and sets FLASHCARDS_DERIVED.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
