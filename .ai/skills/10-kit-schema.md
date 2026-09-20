---
name: kit-schema-and-validation
load_when: creating or changing the kit schema, types, validateKit or request validation
depends_on: [00-rules]
related: [11-architecture, 34-coverage, 35-schedule]
code: packages/core/src/schema, packages/core/src/validate
---

# Kit schema and validation

## 3.1 Kit structure (Appendix A)

Field names must match exactly. You may add fields, but you may not rename or remove these.

| Path                                 | Rule                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `source.company`                     | string                                                                  |
| `source.company_url`                 | string                                                                  |
| `source.role`                        | string                                                                  |
| `source.location`                    | string (use `""` when the posting gives none)                           |
| `source.jd_chars`                    | integer, length of the pasted job description                           |
| `source.researched_at`               | ISO 8601 timestamp                                                      |
| `source.pages_used`                  | array of URLs you actually fetched and used                             |
| `company_brief.summary`              | string                                                                  |
| `company_brief.what_they_do`         | string                                                                  |
| `company_brief.sources`              | array of URLs                                                           |
| `role.title`                         | string                                                                  |
| `role.seniority`                     | string                                                                  |
| `role.responsibilities`              | array of strings                                                        |
| `role.requirements[]`                | `{ id, text, kind, priority }`                                          |
| `requirements[].id`                  | stable id such as `r1`                                                  |
| `requirements[].kind`                | `technical`, `behavioural` or `domain`                                  |
| `requirements[].priority`            | `must` or `nice`, taken from the posting's wording                      |
| `questions[]`                        | `{ id, requirement_ids, category, prompt, answer_outline, difficulty }` |
| `questions[].category`               | `technical`, `behavioural`, `system-design` or `company-fit`            |
| `questions[].difficulty`             | integer 1 to 3                                                          |
| `flashcards[]`                       | `{ id, front, back, requirement_ids }`                                  |
| `schedule.days_available`            | integer, equals the requested days                                      |
| `schedule.days[]`                    | `{ day, focus, question_ids, minutes }`                                 |
| `schedule.days[].minutes`            | integer, never a float or text                                          |
| `coverage.uncovered_requirement_ids` | array of ids                                                            |
| `coverage.passes`                    | integer                                                                 |

Cross-reference rules the validator must enforce:

- Every id is unique inside its list and stays stable inside the kit.
- Every `requirement_ids` entry in a question or flashcard points to an existing requirement.
- Every `question_ids` entry in the schedule points to an existing question.
- `schedule.days.length === schedule.days_available`, and day numbers run 1 to N.
- Every must-have requirement appears in at least one scheduled question.

## 3.2 Extension fields (allowed, recommended)

The brief lets you extend the structure "where that genuinely helps". These extensions support honesty, the builder and the tests. Keep them next to the required fields, never in place of them.

```jsonc
{
  "warnings": [
    {
      "code": "THIN_JOB_DESCRIPTION",
      "message": "Only 2 requirements could be extracted from 180 characters.",
    },
  ],
  "id_counters": { "r": 0, "q": 0, "f": 0 },
  "role": {
    "requirements": [
      {
        "id": "r1",
        "text": "5+ years with React",
        "kind": "technical",
        "priority": "must",
        "evidence": "5+ years of professional experience with React",
      },
    ],
  },
  "questions": [
    {
      "id": "q1",
      "requirement_ids": ["r1"],
      "category": "technical",
      "prompt": "...",
      "answer_outline": "...",
      "difficulty": 2,
      "origin": "generated", // generated | user | fallback
      "edited": false,
      "pinned": false,
    },
  ],
  "company_brief": { "edited_fields": [] },
  "research": {
    "pages": [
      { "url": "...", "kind": "hiring", "status": "fetched", "reason": null },
    ],
    "discussion": { "status": "none_found", "sources": [] },
    "hiring_process": { "found": false, "rounds": [] },
  },
}
```

## 3.5 Other fixed points

- JavaScript or TypeScript only.
- Free-tier LLM provider. No key is supplied to you.
- Sequencing must be genuine: pasted text needs no retrieval, a homepage needs crawling, a found hiring page changes the questions, and technical and behavioural requirements come from different calls with different instructions.
- Invented requirements are worse than few requirements.

## 6.14 Validation

**Brief**: validate incoming requests, and validate a generated kit against the expected structure before saving.

- **AGENT**: a Zod (or Ajv) schema for the kit, request schemas for each endpoint, structured error responses `{ error: { code, message, details } }`.
- **GUIDE**: `validateKit(kit)` runs the schema check and then the cross-reference checks from 3.1 (unique ids, requirement references, schedule references, day count, integer minutes, difficulty range, must coverage). It returns a list of problems, not a boolean, so failures are readable. The server calls it before every save. The pipeline calls it before returning. Generate the schema from Appendix A pasted verbatim, not from the agent's own idea of the structure.
- **Input limits to set**: job description up to 20,000 characters, company URL up to 2,048 characters, days an integer within a range you document (1 to 90 recommended). Accept numeric strings such as `"5"` and coerce them. Reject everything else with `INVALID_INPUT`.

## Done when
- The Zod schema is generated from Appendix A pasted verbatim and types are inferred from it.
- validateKit returns a list of problems, not a boolean.
- Tests cover: missing field, bad requirement reference, bad schedule reference, float minutes, difficulty 4, wrong priority value, duplicate id, day count mismatch, uncovered must.
- Extension fields in use are listed in DECISIONS.md.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
