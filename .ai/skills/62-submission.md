---
name: submission
load_when: writing the README, recording the video, or running the final checklist
depends_on: [00-rules]
related: [02-decisions]
code: README.md
---

# Submission

## 11.2 README outline (YOU write, AGENT can format)

Write these sections. Most are copies of your `DECISIONS.md` entries.

1. Project overview and stack (with justification if you deviate)
2. Setup: local, deployed, and the exact batch command
3. LLM provider and model, with the limits you designed for
4. Architecture, with a short diagram and the dependency rule from 5.2
5. Retrieval approach and the sources used (site crawl, robots.txt, sitemap, the discussion source), and the sources you rejected with a reason
6. Step sequence and what each step is responsible for (5.3 table in your words)
7. Generated, edited and pinned state, with the regeneration rules (7.6)
8. Schedule allocation (6.12)
9. Coverage passes and the stopping rule (6.11)
10. Edge case handling (6.17 table)
11. Long-running generation, failure halfway and duplicate handling (6.15)
12. The batch command's outcome rules, error codes and the D6 decision
13. Creative feature, if any
14. Key design decisions, trade-offs and known limitations (be honest: name what does not work)

## 11.3 Video script (3 to 4 minutes)

Rehearse once. Clarity matters more than production value. Keep the app open and the data prepared, so you do not wait on screen.

| Time         | Content                                                                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00 to 0:20 | One sentence on the problem and the app                                                                                                                                       |
| 0:20 to 1:10 | Create a kit from a pasted description and a company URL. Show the progress view: pages fetched and skipped, the hiring page found, discussion searched                       |
| 1:10 to 1:50 | Research and generation steps in your words. Show the trace where the first check found a gap and the second pass closed it. Mention which steps are code and which are model |
| 1:50 to 2:30 | Edit a question, reorder it, move it to another category, regenerate that category, and show your edit survived                                                               |
| 2:30 to 3:00 | Practice mode: reveal, rate, coverage panel, next session ordering. Then the schedule                                                                                         |
| 3:00 to 3:30 | Creative feature, if you built one                                                                                                                                            |
| 3:30 to 3:50 | One design decision you defend (recommended: the merge rule that computes the replaceable set at merge time, or the model-free coverage and schedule steps)                   |

## 13. Final checklist before you submit

**Batch command**

- [ ] Fresh clone, documented install, `npm run evaluate -- --input cases.json --output kits.json` works
- [ ] 5 cases finish under 15 minutes, with the real time noted in the README
- [ ] One failing case does not stop the run, and the output has one entry per case
- [ ] Output matches Appendix B, and each kit passes your `validateKit`
- [ ] Only variables from `.env.example` are needed
- [ ] A run with only the primary key set works, and a fallback key that is missing or exhausted does not crash it
- [ ] No generated output files, caches or secrets are committed

**Kit content**

- [ ] Two-line job description gives a small kit with a warning, no invented requirements
- [ ] Company with no hiring page gives an honest brief and a warning
- [ ] Dead company URL gives an `ok` kit with a recorded gap (or your documented alternative)
- [ ] Every must-have has a question. `coverage.passes` is set
- [ ] Schedule has exactly the requested days, for 1 and for 60
- [ ] All ids resolve. All minutes are integers. All difficulties are 1 to 3

**Security**

- [ ] Private and loopback addresses rejected in production, including through redirects
- [ ] Content-type and size limits enforced
- [ ] Injection fixtures do not change the kit

**App**

- [ ] Register, login, logout, expired session, and user isolation tested
- [ ] Generation shows progress, partial and failed states, and supports retry
- [ ] Edit, reorder, move, add, delete and regenerate work, and edits survive regeneration
- [ ] Practice mode records confidence, shows coverage and orders by your rule
- [ ] Keyboard-only run-through completed. 375 px check completed
- [ ] Deployed frontend and backend both reachable, and a kit survives a page reload on your phone

**Submission**

- [ ] Public repo (or access granted), commit history readable, no secrets committed
- [ ] README has every section in 11.2
- [ ] Video is 3 to 4 minutes and covers each item in 11.3
- [ ] Submitted with at least a few hours of margin

## Done when
- The README has every section in the outline.
- The video is 3 to 4 minutes and covers each item in the script.
- Every box in the final checklist is ticked.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
