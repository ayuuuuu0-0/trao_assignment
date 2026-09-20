---
name: creative-feature
load_when: only after the core, batch command and deployment are solid
depends_on: [00-rules, 52-practice]
related: [35-schedule]
code: packages/web, packages/core
---

# Creative feature

## 8. Creative feature (optional)

The brief says this is not required, and the 10 points for "practice mode and your creative feature" are shared. Build it only after the core, the batch command and deployment are solid. If you skip it, say nothing more than that in the README.

**Rule from the brief**: it should address a real problem someone preparing for an interview has. It must not be cosmetic.

| Option               | Problem it solves                                                            | Cost               | Note                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Weak-spots report    | The candidate cannot tell which requirements they are least ready for        | About 2 to 3 hours | Uses practice confidence data you already store. Deterministic.                                                    |
| Adaptive re-plan     | The schedule was set on day 0, but by day 3 the candidate knows what is weak | About 3 to 4 hours | Re-run your existing allocator on the remaining days, weighting questions by low confidence. Reuses the scheduler. |
| Printable one-pager  | The candidate wants a single sheet for the morning of the interview          | About 2 hours      | Print stylesheet or a generated HTML page                                                                          |
| Compare two postings | The candidate applies to two roles and wants the overlap                     | About 4 hours      | Needs requirement matching                                                                                         |
| Mock interview mode  | Reading is different from answering aloud                                    | About 4 to 6 hours | Needs another model call and feedback design, which raises risk                                                    |

**Recommended**: the weak-spots report with an adaptive re-plan button. The report groups practice confidence by requirement (through each flashcard's `requirement_ids`), lists must-have requirements with the lowest average confidence or no practice, and the re-plan button re-allocates the remaining days weighting those questions first. Everything in it is deterministic, so it is testable and cannot produce invented content.

- **YOU**: pick one, and write two or three sentences in the README on why you built it and what problem it solves.
- **AGENT**: implement after you specify the data it reads and the exact weighting.
- **GUIDE**: for the re-plan, specify that the allocator takes an optional per-question weight and that the same post-conditions from 6.12 still hold.

## Done when
- The feature is deterministic and tested, or explicitly not built.
- The README has two or three sentences on why it exists and what problem it solves.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
