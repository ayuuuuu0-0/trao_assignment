---
name: architecture-and-environment
load_when: scaffolding packages, adding environment variables, or changing the pipeline order
depends_on: [00-rules]
related: [10-kit-schema, 30-llm-client]
code: package.json, .env.example, packages/*
---

# Architecture and environment

## 5.1 Repository layout (recommended)

```
/
├─ package.json              workspaces + the "evaluate" script
├─ .env.example              every variable, with a one-line purpose
├─ DECISIONS.md
├─ README.md
└─ packages/
   ├─ core/                  pure pipeline. No Express. No MongoDB.
   │  └─ src/
   │     ├─ schema/          zod schema and types generated from Appendix A
   │     ├─ retrieval/       safeFetch, robots, crawler, linkRanker, cleaner, search
   │     ├─ llm/             client, rate limiter, JSON parsing, prompts/
   │     ├─ steps/           extractRequirements, extractProcess, companyBrief,
   │     │                   generateQuestions, generateFlashcards
   │     ├─ coverage/        checkCoverage, repairCoverage
   │     ├─ schedule/        allocate
   │     ├─ ops/             pure kit edit and merge functions (shared with the web app)
   │     ├─ validate/        validateKit, cross-reference checks
   │     └─ pipeline.ts      runPipeline(input, options)
   ├─ server/                Express: auth, kits, jobs, practice, Mongo models
   ├─ web/                   Next.js + Tailwind
   └─ cli/                   evaluate.ts
```

## 5.2 The dependency rule

`core` imports nothing from `server`, `web` or `cli`. `server` and `cli` import `core`. This one rule delivers three requirements at once:

1. The batch command and the web app run the same code, as Section 9 demands.
2. The batch command needs no database, so it runs with no setup beyond install.
3. Retrieval, extraction, generation, scheduling and persistence stay separate, as Section 13 demands.

- **AGENT**: scaffold the workspaces and the `evaluate` script.
- **GUIDE**: tell the agent to add a lint rule or a test that fails if anything under `packages/core` imports `express`, `mongoose` or `mongodb`.
- **YOU**: the README architecture section, in your own words, with a short diagram.

## 5.3 Pipeline order and data flow

| #   | Step                      | Input                                          | Output                                                                   | Model call?                |
| --- | ------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ | -------------------------- |
| 1   | Extract requirements      | Job description                                | title, seniority, location, responsibilities, requirements with evidence | Yes, then code checks      |
| 2   | Crawl company site        | Company URL                                    | Cleaned pages, each labelled `about`, `hiring` or `other`                | No                         |
| 3   | Search public discussion  | Company name                                   | Filtered snippets                                                        | No                         |
| 4   | Extract interview process | Hiring pages and discussion snippets           | Rounds and formats, each with evidence                                   | Yes, only if there is text |
| 5   | Company brief             | About pages, JD company paragraph              | `summary`, `what_they_do`                                                | Yes, only if there is text |
| 6   | Plan question counts      | Requirements, process, seniority               | Count per category                                                       | No (code)                  |
| 7   | Generate questions        | Requirements of one kind, process notes, count | Questions for one category                                               | Yes, one call per category |
| 8   | Generate flashcards       | Questions, requirements                        | Flashcards                                                               | Yes, with a code fallback  |
| 9   | Coverage check and repair | Requirements, questions                        | Gap list, repair calls, fallback questions                               | Repair calls only          |
| 10  | Schedule                  | Questions, requirements, days                  | Schedule                                                                 | No (code)                  |
| 11  | Assemble and validate     | All outputs                                    | Final kit                                                                | No (code)                  |

Steps 1, 2 and 3 do not depend on each other. Run them together to save time in the 15-minute batch budget. Steps 4 and 5 wait for 2 and 3. Step 7 depends on steps 1, 4 and 6.

## 5.4 Environment variables

Document every one in `.env.example` with a one-line purpose.

| Variable                                                                    | Used by           | Purpose                                                                                |
| --------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------- |
| `LLM_API_KEY`                                                               | core, cli, server | Credential for the LLM provider                                                        |
| `LLM_BASE_URL`                                                              | core              | Provider endpoint (OpenAI-compatible recommended)                                      |
| `LLM_MODEL`                                                                 | core              | Model name                                                                             |
| `LLM_MODEL_EXTRACT`                                                         | core              | Optional stronger model used for requirement extraction only                           |
| `LLM_FALLBACK_1_BASE_URL`, `LLM_FALLBACK_1_API_KEY`, `LLM_FALLBACK_1_MODEL` | core              | Optional first fallback provider. Repeat with `_2_` for a second. Unset means not used |
| `LLM_DEV_CACHE`                                                             | core              | `1` enables the dev only response cache. Leave unset in graders' runs and production   |
| `LLM_RPM`, `LLM_TPM`                                                        | core              | Your limiter's ceilings, so graders on a different tier can tune them                  |
| `LLM_CONCURRENCY`                                                           | core              | Simultaneous model calls (1 or 2)                                                      |
| `ALLOW_PRIVATE_HOSTS`                                                       | core, cli         | `true` only in the batch command and local tests. Never set in production              |
| `CRAWL_MAX_PAGES`                                                           | core              | Page budget per company                                                                |
| `MONGODB_URI`                                                               | server            | Atlas connection string                                                                |
| `SESSION_SECRET`                                                            | server            | Signs session cookies                                                                  |
| `CLIENT_ORIGIN`                                                             | server            | Allowed CORS origin                                                                    |
| `NODE_ENV`, `PORT`                                                          | server            | Standard                                                                               |
| `NEXT_PUBLIC_API_URL`                                                       | web               | Backend address, if you do not proxy                                                   |

## Done when
- A test or lint rule fails if packages/core imports express, mongoose, mongodb or next.
- .env.example lists exactly the variables the code reads, with dummy values and a one-line purpose.
- pipeline.ts follows the step order and dependencies in the pipeline table.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
