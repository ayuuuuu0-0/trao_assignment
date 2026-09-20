# .ai index

Working instructions for the coding agent, split by feature so each step loads only what it needs. The full plan is the archived master plan (.ai/PLAN.MD), which is for humans.

## Load protocol

Before any task, read `.ai/README.md`. Always load `.ai/skills/00-rules.md` and `.ai/skills/01-workflow.md`. Then load only the skill named for the current step in the routing table. Never load the master plan unless asked.

1. Always load skills/00-rules.md and skills/01-workflow.md (about 90 lines together).
2. Load the one skill for the current step from the routing table, plus the files in its depends_on line. Load at most three skills per step.
3. Load skills/02-decisions.md only when writing DECISIONS.md or when a YOU decision is missing.
4. Never load the master plan unless the user asks.
5. Items tagged YOU are decisions. Read DECISIONS.md. If the entry is missing, stop and ask.

## Routing table
| Working on | Load |
|---|---|
| Kit schema, validateKit, request validation | skills/10-kit-schema.md |
| Repo layout, environment variables, pipeline order | skills/11-architecture.md |
| safeFetch, SSRF, content types and sizes | skills/20-safe-fetch.md |
| Crawler, link ranking, robots, sitemap | skills/21-crawler.md |
| Public interview discussion search | skills/22-discussion-search.md |
| Prompt wrapping and injection tests | skills/23-prompt-safety.md |
| Model adapter, limiter, fallback chain, dev cache | skills/30-llm-client.md |
| Requirement extraction | skills/31-extraction.md |
| Interview process, company brief | skills/32-process-brief.md |
| Question planning and generation, flashcards | skills/33-questions-flashcards.md |
| Coverage check and repair loop | skills/34-coverage.md |
| Schedule allocator | skills/35-schedule.md |
| Jobs, checkpoints, resume, duplicates | skills/40-jobs-duplicates.md |
| Batch command, edge cases | skills/41-batch-cli.md |
| Auth, Express app, Mongo models, API routes | skills/42-auth-server.md |
| Kit operations, regeneration, state model | skills/50-kit-ops.md |
| Frontend pages, states, accessibility | skills/51-frontend.md |
| Practice mode | skills/52-practice.md |
| Creative feature | skills/53-creative.md |
| Tests | skills/60-tests.md |
| Deployment | skills/61-deploy.md |
| README, video, final checklist | skills/62-submission.md |
| Deadline, daily goals, progress | SCHEDULE.md |
| Requirement status | REQUIREMENTS.md |
| Reports and plans | templates/ |

## Section number map
| Master plan section | Skill file |
|---|---|
| 3.1, 3.2, 3.5, 6.14 | 10-kit-schema |
| 3.3, 6.16, 6.17 | 41-batch-cli |
| 4 (D1 to D17) | 02-decisions, with D2 in 30, D3 in 22, D4 in 34, D5 in 31, D6 in 41, D7 in 40, D9 in 52 |
| 5.1 to 5.4 | 11-architecture |
| 6.1 | 42-auth-server |
| 6.2 | 20-safe-fetch |
| 6.3 | 21-crawler |
| 6.4 | 22-discussion-search |
| 6.5 | 23-prompt-safety |
| 6.6 | 31-extraction |
| 6.7, 6.8 | 32-process-brief |
| 6.9, 6.10 | 33-questions-flashcards |
| 6.11 | 34-coverage |
| 6.12 | 35-schedule |
| 6.13 | 30-llm-client |
| 6.15 | 40-jobs-duplicates |
| 7.1 to 7.5, 7.9 | 51-frontend |
| 7.6, 7.7 | 50-kit-ops |
| 7.8 | 52-practice |
| 8 | 53-creative |
| 9 | 60-tests |
| 10 | 61-deploy |
| 11.2, 11.3, 13 | 62-submission |
| 12 | SCHEDULE.md |

## Keeping it consistent
1. One topic lives in one file. Do not copy rules between skills. Link by name instead.
2. If a decision changes, edit the skill file and DECISIONS.md in the same commit.
3. The master plan is an archive after the split. Do not edit both.
