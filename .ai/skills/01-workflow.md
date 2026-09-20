---
name: workflow
load_when: always
---

# Workflow (always load)

## Before a step
1. Read .ai/README.md, pick the skill from the routing table, load it and the files it depends on.
2. Read the DECISIONS.md entries the skill names.
3. Post a plan using templates/step-plan.md. Wait for approval.

## During a step
1. Contracts and schemas first, then tests, then implementation.
2. One logical unit per commit. A schema, a validator and a CLI runner are three commits.
3. Work only on the approved step. If the spec is ambiguous, stop and ask.
4. Keep commits local while working. Push to a private remote at each checkpoint for backup.

## Definition of done
1. npm run check passes (typecheck, lint, tests).
2. New behaviour has tests, including failure cases. Break the code once on purpose and confirm a test fails.
3. .env.example, DECISIONS.md and README notes are in sync.
4. git status is clean with no generated files, caches or secrets staged.
5. REQUIREMENTS.md rows for this step are updated.
6. The checkpoint report (templates/checkpoint-report.md) is posted and the user has approved.
7. The commit is tagged checkpoint-step-N.

## Commit messages
Outcome oriented, concise, no hyphens or em dashes, no mention of incidental edits, no wording that implies earlier mistakes. Example: Add coverage check with a two round repair loop and a deterministic fallback.

## Live model discipline
1. Live calls only in npm run test:live.
2. Use the dev cache while debugging (LLM_DEV_CACHE=1).
3. Log live calls per run. Stop and ask if a session passes 100.

## Stop and ask when
- The spec is ambiguous or two skills disagree.
- A test would have to be weakened.
- A new dependency is needed.
- The schema, DECISIONS.md or a prompt must change.
- A YOU decision is missing.
- The day's goals in SCHEDULE.md are at risk.

## End of day routine
1. npm run check.
2. Clean clone batch test (required from Tuesday on).
3. Update REQUIREMENTS.md and the progress log in SCHEDULE.md.
