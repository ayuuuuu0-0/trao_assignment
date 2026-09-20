---
name: practice-mode
load_when: building flashcard practice, confidence recording or the coverage panel
depends_on: [00-rules, 51-frontend]
related: [50-kit-ops]
code: packages/web/src/practice, packages/server/src/practice
---

# Practice mode

## 7.8 Practice mode

**Brief**: step through flashcards one at a time with a reveal, record confidence, show what is covered and what is not, order the next session by least confidence.

- **AGENT**: `FlashcardStep` (front, Reveal, back), `ConfidenceButtons`, `CoveragePanel`.
- **GUIDE (data)**: store one record per user, kit and card: `{ cardId, confidence (1 to 5), seenCount, lastSeenAt }`. Keep these in a separate collection from the kit, so kit edits and regeneration never touch them. Ignore records whose card no longer exists. Save each rating right away with a small request and update the screen optimistically.
- **GUIDE (ordering, D9)**: build the queue with this sort: unseen cards first, then lower last confidence first, then older `lastSeenAt`, then kit order. Session size 10 cards, with a "Continue" button that builds the next queue.
- **GUIDE (keyboard)**: Space reveals the answer. Keys 1 to 5 record confidence. Provide visible buttons for the same actions.
- **GUIDE (coverage panel)**: show cards seen versus total, and a per-requirement view: a requirement is "not covered" until at least one of its cards has been seen. List must-have requirements with no seen cards first.
- **YOU**: the ordering rule and its one-sentence defence. If you choose spaced repetition instead, write the interval table (for example confidence 1 returns tomorrow, 3 in 3 days, 5 in 7 days) and cap it by the days left before the interview.

## D9. Practice ordering

- **Options**: confidence-weighted sort, or a spaced-repetition interval scheme.
- **Recommendation for a 4-day timebox**: unseen cards first, then lowest last confidence, then oldest last-seen time, then kit order. A one-sentence defence: the user's stated confidence is the only signal you have, and the sort uses it directly with no interval maths to get wrong.
- **Record**: the sort key order and the rating scale (1 to 5 recommended).

## Done when
- The ordering function is pure and tested: unseen first, then lowest confidence, then oldest last seen.
- Ratings persist per user, kit and card and survive a reload.
- Space reveals, keys 1 to 5 rate, and visible buttons exist for the same actions.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
