---
name: coverage-loop
load_when: implementing the coverage check, the repair loop or the must-have fallback question
depends_on: [00-rules, 10-kit-schema, 30-llm-client]
related: [33-questions-flashcards]
code: packages/core/src/coverage
---

# Coverage loop

## 6.11 Coverage check and the second pass

**Brief**: after the first draft, the system compares questions against requirements. Any requirement with no question against it is a gap. It must act on the gaps by generating missing questions, then check again. A kit must not ship with uncovered must-haves.

- **AGENT**: the pure check function and the loop skeleton.
- **GUIDE (check function)**:

```ts
checkCoverage(requirements, questions) -> {
  uncovered: string[],        // ids with no question
  uncoveredMust: string[]     // subset with priority "must"
}
// A requirement is covered if any question lists its id in requirement_ids.
// Ignore ids that do not exist in requirements.
```

Pure function. No model, no I/O. It is the piece the brief says must not be the model's decision.

- **GUIDE (loop)**:

```
passes = 0
repairs = 0
loop:
  passes += 1
  gaps = checkCoverage(...)
  if gaps.uncovered is empty: break
  if repairs == MAX_REPAIRS (2): break
  group gap ids by category (technical -> technical, behavioural -> behavioural,
                             domain -> technical)
  for each group: call the model with "write questions for these requirement ids only"
  validate returned ids, append new questions with new ids
  repairs += 1
after loop:
  for each id still in gaps.uncoveredMust:
    add a fallback question built by code (see below), origin = "fallback"
  passes += 1 and check once more
  coverage = { uncovered_requirement_ids: remaining, passes }
```

Fallback question: category from the requirement kind, prompt `Describe your experience with: <requirement text>. Give a concrete example.`, `answer_outline` states plainly that this is a generic question added because no specific question was generated, difficulty 2. Add warning `MUST_COVERAGE_FALLBACK`. This guarantees no must-have ships uncovered.

- **Optional check to add**: a keyword-overlap sanity test between a repair question's prompt and the requirement text. It catches a model that lists an id without addressing it. Skip it if time is short.
- **YOU (D4)**: the pass limit, the fallback and the meaning of `passes`.
- **Test yourself**: remove one question from a fixture and confirm the loop closes the gap. Use a fake LLM that returns invalid ids twice, and confirm the fallback fires. You will show the gap closing in the video, so make the trace visible (log each pass with the gap ids).

## D4. Coverage passes and stopping rule

- **Definition to fix**: `coverage.passes` counts coverage checks run, so the first check after the first draft is pass 1.
- **Recommendation**: at most 2 repair rounds after the first draft, so at most 3 checks. After the last round, any must-have still uncovered gets a deterministic fallback question built by code from the requirement text (see 6.11). Nice-to-have gaps that remain are listed in `uncovered_requirement_ids`.
- **Reasoning to write**: round one fixes omissions. Round two fixes a model that returned invalid ids or ignored the target. A third round rarely changes the outcome and costs 1 to 2 more calls per case. The fallback guarantees the rule that a kit never ships with an uncovered must-have.
- **Record**: the limit, the fallback, the meaning of `passes`.

## Done when
- checkCoverage is pure and tested: no gaps, one gap, a gap for a must, ids that do not exist.
- The loop closes a gap with a fake client.
- With a fake client that returns bad ids twice, the fallback question fires and passes is correct.
- Each pass logs its gap ids, so the video can show the second pass closing a gap.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
