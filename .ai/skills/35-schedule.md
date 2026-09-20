---
name: schedule-allocator
load_when: implementing or changing the schedule allocator
depends_on: [00-rules, 10-kit-schema]
related: [34-coverage, 50-kit-ops]
code: packages/core/src/schedule/allocate.ts
---

# Schedule allocator

## 6.12 Schedule allocation (deterministic)

**Brief**: the schedule covers exactly the requested days. Each day has a focus, question ids and integer minutes. Every must-have appears. Harder and higher-priority material lands earlier. It belongs in code, not in a prompt.

- **AGENT**: implement the function from your spec and write the unit tests.
- **YOU**: the algorithm. A complete recommended version follows. Change any number, but know why.

**Recommended algorithm** `allocate(questions, requirements, N) -> schedule`

1. **Priority score** per question: 2 if it covers at least one `must` requirement, otherwise 1.
2. **Sort** questions by priority score descending, then `difficulty` descending, then number of must-haves covered descending, then id ascending (stable and repeatable).
3. **Minutes per question** by difficulty: 1 gives 10, 2 gives 15, 3 gives 20. All integers.
4. **Case Q >= N** (at least as many questions as days):
   - Give each day 1 question first, so no day is empty.
   - Distribute the remaining `Q - N` questions with weights `w(d) = 2N - d + 1`. Day 1 receives up to about twice as many extra questions as the last day, which leaves the last days lighter for review. Use largest-remainder rounding so quotas sum exactly to `Q - N`.
   - Deal the sorted list into consecutive blocks by quota. Day 1 receives the hardest, highest-priority questions.
5. **Case Q < N** (more days than questions):
   - Days 1 to Q each hold one question, in sorted order.
   - Days Q+1 to N are review days. Cycle through the sorted list, hardest first, one question per day, with minutes equal to half the original rounded up (10 becomes 5, 15 becomes 8, 20 becomes 10). Prefix the focus with `Review:`.
   - The result still has exactly N days and every day has at least one question id.
6. **Case Q = 0**: every day has an empty `question_ids`, minutes 0, and focus "No questions available. Add questions in the builder." Also add a warning.
7. **Day minutes**: the sum of its question minutes. An integer.
8. **Day focus** (no model): the category label and the text of the first requirement covered by the day's top question, cut at 60 characters. Example: `Technical: 5+ years with React`.
9. **Do not drop questions.** The scoring line reads "allocates all of it". For `N = 1` with 30 questions the day holds 450 minutes. Keep every question and add warning `SCHEDULE_OVER_CAPACITY` when a day exceeds a threshold you choose (for example 240 minutes). Tell the user in the UI that this plan is too dense for one day.
10. **Post-conditions** (assert them in code; a violation is a bug, so throw):
    - `days.length === N` and days are numbered 1 to N.
    - Every `question_ids` entry exists.
    - Every must-have requirement is covered by at least one scheduled question.
    - Every question appears at least once.
    - Difficulty-3 questions with `must` priority all sit in the first half of the days when `Q >= N`.

**Worked example** (5 days, 30 questions): each day gets 1 question first, leaving 25 extras. The weights 10, 9, 8, 7, 6 (total 40) give raw shares of 6.25, 5.63, 5.00, 4.38 and 3.75. Floors sum to 23, and largest-remainder rounding gives the last 2 to days 5 and 2, so the extras are 6, 6, 5, 4, 4. Day totals are 7, 7, 6, 5, 5, which sums to 30.

- **GUIDE (tests first)**: give the agent the test list before the implementation: days count equals request for N = 1, 2, 5, 14, 60; no empty day when Q >= N; all must ids present; all `question_ids` exist; minutes are integers; hard must items appear early; the function returns the same output for the same input; N = 1 keeps all questions; N = 60 with 30 questions returns 60 days.
- **Optional**: property-based tests with random inputs (a library such as `fast-check`) to check the post-conditions.

## Done when
- Tests pass for N = 1, 2, 5, 14 and 60, and for Q greater than, equal to and less than N, and Q = 0.
- Post-conditions are asserted in code: exact day count, ids exist, every must covered, every question scheduled, hard must items early.
- The function is pure and repeatable: same input, same output.
- No question is dropped for a 1-day plan. SCHEDULE_OVER_CAPACITY is set when a day is too dense.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
