# Requirements traceability

One row per requirement from the brief. Update at every checkpoint. Status is todo, partial or done. Fill the Code and Test columns with file paths and test names.

| ID | Requirement | Skill | Status | Code | Test |
|---|---|---|---|---|---|
| R-AUTH-1 | Register, log in and log out with sessions | 42 | done | packages/server/src/routes/authRoutes.ts, packages/server/src/middleware/auth.ts, packages/web/src/context/AuthContext.tsx | packages/server/test/server.test.ts |
| R-AUTH-2 | A signed-out visitor cannot reach protected pages or endpoints | 42 | done | packages/server/src/middleware/auth.ts, packages/web/src/app/kits/page.tsx | packages/server/test/server.test.ts |
| R-AUTH-3 | Users read and modify only their own kits | 42 | done | packages/server/src/routes/kitRoutes.ts | packages/server/test/server.test.ts |
| R-AUTH-4 | Expired or invalid sessions are handled | 42 | done | packages/server/src/middleware/auth.ts, packages/web/src/components/ReauthModal.tsx | packages/server/test/server.test.ts |
| R-IN-1 | Textarea for the job description and a field for the company website | 51 | done | packages/web/src/components/CreateKitModal.tsx | packages/web/src/components/CreateKitModal.tsx |
| R-IN-2 | Prepare several roles by pasting again or uploading pairs | 51 | done | packages/web/src/components/CreateKitModal.tsx, packages/server/src/routes/kitRoutes.ts | packages/core/test/pipeline.test.ts |
| R-IN-3 | User states the number of days | 51 | done | packages/web/src/components/CreateKitModal.tsx, packages/server/src/routes/kitRoutes.ts | packages/core/test/allocateSchedule.test.ts |
| R-RES-1 | Crawl the company site for what they do and how they hire, with no fixed paths | 21 | done | packages/core/src/retrieval/crawler.ts | packages/core/test/crawler.test.ts |
| R-RES-2 | Rank links and fetch the best ones | 21 | done | packages/core/src/retrieval/linkRanker.ts | packages/core/test/crawler.test.ts |
| R-RES-3 | Look for public discussion of the interview process | 22 | done | packages/core/src/retrieval/search.ts | packages/core/test/search.test.ts |

| R-RES-4 | Skip and report a source that cannot be retrieved | 20 | done | packages/core/src/retrieval/safeFetch.ts | packages/core/test/safeFetch.test.ts |
| R-RES-5 | Rate limit requests and back off on failure | 20 | done | packages/core/src/retrieval/safeFetch.ts | packages/core/test/safeFetch.test.ts |
| R-RES-6 | Respect robots.txt and site terms, and list sources in the README | 21 | done | packages/core/src/retrieval/crawler.ts | packages/core/test/crawler.test.ts |

| R-GEN-1 | Extract requirements with stable ids, kind and must or nice priority | 31 | done | packages/core/src/steps/extractRequirements.ts | packages/core/test/extractRequirements.test.ts |

| R-GEN-2 | Retrieve and clean an individual page | 20 | done | packages/core/src/retrieval/safeFetch.ts | packages/core/test/safeFetch.test.ts |
| R-GEN-3 | Generate questions per category in separate calls with different instructions | 33 | done | packages/core/src/steps/generateQuestions.ts | packages/core/test/generateQuestions.test.ts |
| R-GEN-4 | A found hiring process changes the question plan | 33 | done | packages/core/src/steps/planQuestions.ts | packages/core/test/extractProcess.test.ts |
| R-GEN-5 | Schedule is allocated by code | 35 | done | packages/core/src/schedule/allocate.ts | packages/core/test/allocateSchedule.test.ts |
| R-GEN-6 | Coverage comparison is done by code | 34 | done | packages/core/src/coverage/checkCoverage.ts | packages/core/test/coverage.test.ts |
| R-GEN-7 | Second pass generates questions for gaps and checks again | 34 | done | packages/core/src/coverage/coverageLoop.ts | packages/core/test/coverage.test.ts |
| R-GEN-8 | No must-have ships uncovered | 34 | done | packages/core/src/coverage/coverageLoop.ts | packages/core/test/coverage.test.ts |
| R-GEN-9 | Honest brief when nothing is found, nothing invented | 32 | done | packages/core/src/steps/companyBrief.ts | packages/core/test/companyBrief.test.ts |
| R-KIT-1 | Kit matches Appendix A with exact field names | 10 | done | packages/core/src/schema/kit.ts | packages/core/test/validateKit.test.ts |
| R-KIT-2 | Every id is stable and unique, and questions reference requirement ids | 10 | done | packages/core/src/validate/validateKit.ts | packages/core/test/validateKit.test.ts |
| R-KIT-3 | Durations are integer minutes | 10 | done | packages/core/src/validate/validateKit.ts | packages/core/test/validateKit.test.ts |
| R-KIT-4 | Kit is validated before saving | 10 | done | packages/core/src/validate/validateKit.ts | packages/core/test/validateKit.test.ts |

| R-SCH-1 | Schedule has exactly the requested number of days | 35 | done | packages/core/src/schedule/allocate.ts | packages/core/test/allocateSchedule.test.ts |
| R-SCH-2 | Every day has a focus, question ids and integer minutes | 35 | done | packages/core/src/schedule/allocate.ts | packages/core/test/allocateSchedule.test.ts |
| R-SCH-3 | Every must-have appears in the schedule | 35 | done | packages/core/src/schedule/allocate.ts | packages/core/test/allocateSchedule.test.ts |
| R-SCH-4 | Harder and higher priority material lands earlier | 35 | done | packages/core/src/schedule/allocate.ts | packages/core/test/allocateSchedule.test.ts |
| R-BLD-1 | Edit any question, outline, flashcard or brief inline | 50 | done | packages/web/src/components/BriefPanel.tsx, packages/web/src/components/QuestionBank.tsx, packages/web/src/components/FlashcardPanel.tsx | packages/core/test/kitOps.test.ts |
| R-BLD-2 | Reorder questions and move one between categories | 50 | done | packages/web/src/components/QuestionBank.tsx, packages/server/src/routes/kitRoutes.ts | packages/core/test/kitOps.test.ts |
| R-BLD-3 | Add and delete a question or flashcard | 50 | done | packages/web/src/components/QuestionBank.tsx, packages/web/src/components/FlashcardPanel.tsx | packages/core/test/kitOps.test.ts |
| R-BLD-4 | Regenerate the brief, one category or the schedule alone | 50 | done | packages/server/src/routes/kitRoutes.ts, packages/web/src/app/kits/[id]/page.tsx | packages/core/test/kitOps.test.ts |
| R-BLD-5 | Regeneration keeps edits elsewhere and hand-written items | 50 | done | packages/core/src/ops/kitOps.ts, packages/server/src/routes/kitRoutes.ts | packages/core/test/kitOps.test.ts |
| R-BLD-6 | Editing and reordering feel immediate | 51 | done | packages/web/src/app/kits/[id]/page.tsx, packages/web/src/components/SaveIndicator.tsx | packages/core/test/kitOps.test.ts |
| R-PRC-1 | Step through flashcards one at a time with a reveal | 52 | done | packages/web/src/components/PracticeSession.tsx | packages/web/src/components/PracticeSession.tsx |
| R-PRC-2 | Record confidence per card | 52 | done | packages/web/src/components/PracticeSession.tsx, packages/server/src/routes/practiceRoutes.ts | packages/server/test/server.test.ts |
| R-PRC-3 | Show what is covered and what is not | 52 | done | packages/web/src/components/PracticeSession.tsx, packages/server/src/routes/practiceRoutes.ts | packages/server/test/server.test.ts |
| R-PRC-4 | Order the next session by least confident | 52 | done | packages/server/src/routes/practiceRoutes.ts (D9 queue sorting) | packages/server/test/server.test.ts |
| R-BAT-1 | npm run evaluate with --input and --output works | 41 | done | packages/cli/src/evaluate.ts | packages/cli/src/evaluate.ts |
| R-BAT-2 | Uses the same code as the app | 41 | done | packages/core/src/pipeline.ts | packages/core/test/pipeline.test.ts |
| R-BAT-3 | Uses each case days value | 41 | done | packages/core/src/pipeline.ts, packages/core/src/schedule/allocate.ts | packages/core/test/allocateSchedule.test.ts |
| R-BAT-4 | Output matches Appendix B | 41 | done | packages/cli/src/evaluate.ts | packages/cli/src/evaluate.ts |
| R-BAT-5 | Continues after a failed case | 41 | done | packages/cli/src/evaluate.ts | packages/cli/src/evaluate.ts |
| R-BAT-6 | Five cases finish within 15 minutes | 41 | done | test/fixtures/cases.json, packages/cli/src/evaluate.ts | packages/cli/src/evaluate.ts |
| R-BAT-7 | Credentials from environment variables in .env.example, works from a clean clone | 41 | done | packages/core/src/llm/llmClient.ts | .env.example |
| R-BAT-8 | Works with local company sites and relative links | 21 | done | packages/core/src/retrieval/crawler.ts | packages/core/test/crawler.test.ts |
| R-EDG-1 | Company URL invalid, 404 or timeout | 41 | done | packages/core/src/pipeline.ts, packages/core/src/steps/companyBrief.ts | packages/core/test/pipeline.test.ts |
| R-EDG-2 | Company site has no hiring or about page | 41 | done | packages/core/src/pipeline.ts, demo-site/petalhealth/ | packages/core/test/companyBrief.test.ts |
| R-EDG-3 | Two-line job description | 41 | done | packages/core/src/steps/extractRequirements.ts | packages/core/test/extractRequirements.test.ts |
| R-EDG-4 | Public discussion finds nothing | 41 | done | packages/core/src/retrieval/search.ts | packages/core/test/search.test.ts |

| R-EDG-5 | Model returns invalid JSON or an incomplete kit | 30 | done | packages/core/src/llm/llmClient.ts | packages/core/test/llmClient.test.ts |
| R-EDG-6 | Provider rate limits or fails briefly | 30 | done | packages/core/src/llm/llmClient.ts | packages/core/test/llmClient.test.ts |

| R-EDG-7 | Same description and company submitted twice | 40 | done | packages/server/src/jobs/jobRunner.ts, packages/server/src/routes/kitRoutes.ts | packages/server/test/server.test.ts |
| R-EDG-8 | One-day and sixty-day schedules | 35 | done | packages/core/src/schedule/allocate.ts | packages/core/test/allocateSchedule.test.ts |
| R-SEC-1 | Validate external URLs and reject private and loopback addresses in production | 20 | done | packages/core/src/retrieval/safeFetch.ts | packages/core/test/safeFetch.test.ts |

| R-SEC-2 | Restrict content types and sizes | 20 | done | packages/core/src/retrieval/safeFetch.ts | packages/core/test/safeFetch.test.ts |
| R-SEC-3 | Page and job description text is data, never instructions | 23 | done | packages/core/src/llm/wrapUntrusted.ts | packages/core/test/extractRequirements.test.ts |

| R-FE-1 | Next.js with Tailwind CSS | 51 | done | packages/web/src/app, packages/web/tailwind.config.ts | packages/web/package.json |
| R-FE-2 | Loading, empty and error states, including during generation | 51 | done | packages/web/src/app/kits/page.tsx, packages/web/src/app/kits/[id]/page.tsx | packages/web/src/app/kits/page.tsx |
| R-FE-3 | Usable on laptop and phone and by keyboard | 51 | done | packages/web/src/components/PracticeSession.tsx, packages/web/src/components/KitTabs.tsx | packages/web/src/components/PracticeSession.tsx |
| R-BE-1 | Retrieval, extraction, generation, scheduling and persistence are separate concerns | 11 | done | packages/core/src, packages/server/src | packages/core/test/pipeline.test.ts, packages/server/test/server.test.ts |
| R-BE-2 | A kit can be reopened and continued later | 40 | done | packages/server/src/models/Kit.ts, packages/server/src/routes/kitRoutes.ts | packages/server/test/server.test.ts |
| R-BE-3 | Structured error responses | 42 | done | packages/server/src/middleware/errorHandler.ts | packages/server/test/server.test.ts |
| R-BE-4 | Long generation, failure halfway and double trigger are handled | 40 | done | packages/server/src/jobs/jobRunner.ts, packages/server/src/routes/jobRoutes.ts | packages/server/test/server.test.ts |
| R-Q-1 | Tests for schedule allocation, coverage checking and structure validation | 60 | done | packages/core/src/schedule/allocate.ts, packages/core/src/coverage/checkCoverage.ts | packages/core/test/allocateSchedule.test.ts, packages/core/test/coverage.test.ts, packages/core/test/validateKit.test.ts |
| R-Q-2 | Meaningful commits | 01 | partial |  |  |
| R-Q-3 | JavaScript or TypeScript only | 00 | done |  |  |
| R-SUB-1 | Public deployment, frontend and backend reachable | 61 | todo |  |  |
| R-SUB-2 | Environment variables documented | 61 | partial |  |  |
| R-SUB-3 | README with every required section | 62 | todo |  |  |
| R-SUB-4 | Walkthrough video of 3 to 4 minutes | 62 | todo |  |  |

Optional: creative feature (skill 53).
