---
name: creative-feature
load_when: only after the core, batch command and deployment are solid — and only if Wednesday 16:00 has not passed
depends_on: [00-rules, 52-practice]
related: [35-schedule]
code: packages/web, packages/core
---

# Creative feature

## 8. Improvement loop (creative feature — D22)

**Condition:** Build only if the core is complete (schema, extraction, generation, coverage, schedule, CLI batch, auth, first deploy) AND Wednesday 16:00 has not passed. If time has run out, write one sentence in the README: "The improvement loop was scoped but not built due to time." Do not apologise.

**Design rule (D19):** Data and code are primary. AI is used sparingly — timer, ordering, debrief recording, and mock session logic are all pure deterministic code with zero model calls. A model call for scoring is only permitted if Part 3 is reached and quota exists.

---

### Part 1 — Debrief log

**What it is:** After a real interview, the user records what happened — the questions asked, their written answers, where they stumbled, and where their confidence dipped.

**Implementation:**
- New route: `/kits/[id]/debrief`
- New MongoDB collection: `debriefs` with fields `{ kitId, userId, createdAt, entries: [{ questionId, questionText, userAnswer, confidence: 1-5, stumbled: boolean }] }`
- UI: one question at a time, answer textarea, confidence buttons (1–5), "I stumbled here" checkbox, Next and Finish.
- **AGENT**: scaffold the form, the schema, and the server route `POST /api/kits/:id/debriefs`.
- **GUIDE**: validate that `questionId` references a question in the kit. Stumbled questions get a confidence cap of 2 regardless of user rating.

---

### Part 2 — Upsolve mock

**What it is:** A targeted practice session generated from the debrief. Like upsolving a contest problem you got wrong — you work specifically on the questions where you stumbled or rated yourself low.

**Implementation:**
- Route: `/kits/[id]/mock?source=debrief&debriefId=<id>`
- Selection: questions where `stumbled === true` or `confidence <= 2` in the linked debrief, surfaced first. Remaining questions fill the session in schedule priority order.
- Timer: per-question countdown, configurable (default from D23). Timer state is local to the session only — not persisted.
- Answer format (D23 — YOU, not yet decided): see D23. Recommended: written answer textarea + timer + self-rated confidence after reveal.
- After the session: show improvement delta — confidence in this session vs. the debrief for the same questions.
- **AGENT**: `MockSession` component reusing `FlashcardStep` layout with an added textarea and timer.
- **GUIDE (ordering)**: `buildMockQueue(kit, debrief, sessionSize)` is a pure function. Test it: stumbled questions come first, then low-confidence, then schedule priority. Same interface as practice queue, different weights.

---

### Part 3 — Pre-interview mock

**What it is:** A full timed run through the kit's questions the morning before an interview, scored entirely from data.

**Implementation:**
- Route: `/kits/[id]/mock?source=full`
- Ordering: improvement loop confidence data (from debrief + upsolve history) weighted against schedule priority. Must-have requirements with lowest average confidence come first.
- Scoring (deterministic): coverage of must-have requirements (how many were answered), average confidence across the session, improvement delta since the first debrief.
- No model call for scoring unless (a) the core is done with time to spare AND (b) you have confirmed LLM quota headroom. If a model call is made, it receives the written answer + the kit's reference outline and returns `{ score: 1-5, feedback: string }` — schema-validated before display.
- **AGENT**: `MockScoreCard` showing the three data-driven scores. A model-scored version is an optional enhancement behind a flag.

---

### Previous creative feature options (for reference)

| Option | Status |
|---|---|
| Weak-spots report + adaptive re-plan | Merged into the improvement loop's scoring and debrief |
| Printable one-pager | Not chosen |
| Compare two postings | Not chosen |

---

## Done when
- The feature is deterministic and tested, or explicitly not built with a one-sentence note in the README.
- `buildMockQueue` is a pure function with unit tests covering: stumbled-first ordering, debrief missing (falls back to confidence sort), empty debrief.
- Debrief save and load survive a page reload.
- Timer counts down, reaching zero moves to the next question automatically.
- The README has two to three sentences on why it exists and what problem it solves.
- D23 is filled in by YOU before the mock answer box is built.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
