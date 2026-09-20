---
name: kit-operations-and-state-model
load_when: implementing edits, reordering, moving, pinning, adding, deleting or regeneration merging
depends_on: [00-rules, 10-kit-schema, 35-schedule]
related: [34-coverage, 51-frontend]
code: packages/core/src/ops
---

# Kit operations and state model

## 7.6 The builder and the state model (15 points)

**Brief**: edit any question, answer outline, flashcard or brief inline. Reorder questions and move one between categories. Add and delete. Regenerate one section without discarding edits elsewhere, and a question the user wrote or edited by hand must survive a regeneration of its category.

This is the hardest part of the assessment. You design the model. A workable design follows.

**Per-item state** (on questions and flashcards):

| Field    | Meaning                                         | Set when                                            |
| -------- | ----------------------------------------------- | --------------------------------------------------- |
| `id`     | Stable, never reused inside a kit               | Created                                             |
| `origin` | `generated`, `user` or `fallback`               | Created                                             |
| `edited` | The user changed prompt, outline, front or back | Any edit to content, and a move to another category |
| `pinned` | The user marked the item as "keep"              | The user toggles it                                 |

An item is **replaceable** only when `origin` is `generated`, `edited` is false and `pinned` is false. Everything else is protected.

**Regeneration rules**:

1. Regenerating a question category replaces only replaceable items in that category. Protected items stay untouched, including their position.
2. New items get new ids. Never reuse an old id, because the schedule, flashcards and practice records refer to ids. Keep a stored counter per id prefix inside the kit (for example `id_counters: { r: 9, q: 12, f: 8 }`) and increment it on every creation. Do not compute the highest id plus one, because deleting the highest id would let it come back.
3. Pass the kept prompts to the model with "do not duplicate these", so the new set does not repeat what the user kept.
4. After the merge, re-run the coverage check. Deleting or replacing questions can leave a requirement uncovered or a schedule entry pointing at a removed id.
5. Repair the schedule without discarding manual arrangement: remove dangling ids from days, then place any new unscheduled question with the allocator's rules (into the day whose remaining load and priority fit best). A full schedule regeneration is a separate, explicit action.
6. If the user **deleted** a question that was the only cover for a must-have, respect the deletion. Show a coverage warning on that requirement with a "Generate a question" button. Do not silently re-add what the user removed.
7. The company brief has per-field `edited_fields`. Regenerating the brief overwrites unedited fields only. If the user edited a field, ask before replacing it, and offer Undo.
8. The schedule is derived. Regenerating it re-runs the allocator over the current questions. Ask for confirmation if the user reordered days by hand.
9. Keep one snapshot of the section before each regeneration (D17) and offer Undo.

**Edits during a regeneration in flight**:

- The server computes the replaceable set **at merge time**, against the latest saved kit, not against a snapshot taken when generation started. An item the user edited or pinned while the model call ran is already protected when the merge happens.
- The client flushes its pending save queue before it applies the regeneration result, then reloads or merges the new server state.
- Disable the Regenerate button for a section while its regeneration runs. The server rejects a second request with `REGENERATION_IN_PROGRESS`.

**Persistence design** (what makes this testable):

- Put the kit operations in `core/ops` as pure functions: `updateQuestion`, `addQuestion`, `deleteQuestion`, `reorderQuestions(category, orderedIds)`, `moveQuestion(id, toCategory, index)`, `togglePin`, the flashcard equivalents, `updateBrief`, and `applyRegeneration(kit, section, generatedItems)`.
- The server applies an operation to the latest stored kit and writes it back with a `version` check (optimistic concurrency). On a version conflict, re-read and retry up to 3 times.
- The client applies the same function to its local state, so edits appear immediately, then sends the operation to the server. Because both sides run the same code, they agree.
- Use per-item and per-operation endpoints (`PATCH /api/kits/:id/questions/:qid`, `POST .../reorder`, `POST .../regenerate`). Do not use a `PUT` that replaces the whole kit. A whole-kit `PUT` from a stale client would overwrite a regeneration that finished a moment earlier.
- Reorder sends the full ordered id list of a category, which makes the request repeatable.

- **YOU**: the state model above, edited to your taste. Write it in your own words for the README, with the merge rule as a short numbered list. This is what the reviewers "will look closely at".
- **AGENT**: implement the model and the reducer as you specify it. Implement reordering.
- **GUIDE (feel of editing)**: local state updates first. Saves run in the background, debounced at about 600 milliseconds per item. Show a `SaveIndicator` with three states: "Saving...", "Saved" and "Could not save, retrying". Typing never waits on the network.
- **GUIDE (reordering that works by keyboard)**: give every question "Move up", "Move down" and "Move to category" controls, reachable by Tab. Drag and drop is optional. If you add it, use a library with keyboard sensors (for example `dnd-kit`), and keep the buttons anyway, since buttons are also the reliable touch and screen-reader path.
- **GUIDE (test)**: edit a question, regenerate its category with a fake LLM, and assert the edit survives, the pinned item survives, a new item has a new id, and dangling schedule ids are gone. Add a second test where the edit happens between the start and the merge of the regeneration.

## 7.7 Regenerating a single section

- **AGENT**: a `RegenerateButton` per section (company brief, each question category, schedule) that calls `POST /api/kits/:id/regenerate` with `{ section, category? }`, shows progress and displays the result.
- **GUIDE**: the request returns a job like kit creation does. It runs the relevant pipeline steps only. Question categories rerun step 7 for one category, then coverage, then schedule repair. Show which items were kept ("3 kept, 5 replaced") after completion, so the user sees that their work survived.

## Done when
- All operations are pure functions in core and are used by both server and web.
- Tests: an edit survives regeneration, a pinned item survives, new items get new ids from the stored counters, dangling schedule ids are removed, an edit made during a regeneration is protected at merge time.
- Endpoints are per-item or per-operation. No endpoint replaces the whole kit.
- Undo for one regeneration is implemented (D17).

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
