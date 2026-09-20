# Engineering Guidelines & Agent Instructions

> **Before any task, read `.ai/README.md`. Always load `.ai/skills/00-rules.md` and `.ai/skills/01-workflow.md`. Then load only the skill named for the current step in the routing table. Never load the master plan unless asked.**

Standard software engineering workflow and coding practices for building reliable, maintainable systems.

---

## 1. Problem Understanding & Schema First Design

1. **Deconstruct Requirements Before Code:**
   - Review specifications thoroughly and identify core entities, relationships, and invariants before writing any code.
   - Separate mandatory requirements from nice-to-have capabilities. Focus execution strictly on the required scope.
2. **Schema and Contract First:**
   - Define data models and database schemas before writing endpoints or business logic.
   - Design explicit API contracts (request payloads, query parameters, response structures, and status codes).
3. **Pace and Incremental Building:**
   - Build deliberately and slowly. Do not attempt to produce the whole system in one huge pass.
   - Establish foundations first (schemas, database connectivity, baseline routing), verify them, and build outwards.

---

## 2. Granular Development & Commit Discipline

1. **Decompose Features into Logical Increments:**
   - Break every feature into small, isolated units (for example: schema definition, route structure, individual service methods, helper scripts).
   - Write one logical unit, test it, review it, and commit it before proceeding to the next.
2. **Commit Hygiene:**
   - Commit frequently at each logical checkpoint. Avoid massive batch commits containing multiple unrelated features.
   - Write professional, concise, and outcome-oriented commit messages in human language simple and understandable no fancy ai literature or structure basic and simple for human understanding.
   - State what the change achieves from a functional or architectural perspective.
   - DO NOT USE hyphens, em-dashes, or awkward formatting in commit messages.
   - Never reference incidental internal edits such as comment adjustments, syntax tweaks, or indentation cleanup in commit messages.
   - Maintain diplomatic commit messages that do not imply previous mistakes or rollbacks.
3. **Local Staging over Automatic Pushing:**
   - Keep commits local during active development.
   - Review the complete change history and ensure all pieces work together before pushing to remote branches.

---

## 3. Human-Grade Code Standards & Aesthetics

1. **Simplicity over Cleverness:**
   - Favor readable, idiomatic code over heavily nested abstractions or unnecessary design patterns.
   - Prefer concise one-liners when clarity is preserved rather than bloated multi-line boilerplate.
   - Avoid framework bloat, complex generators, or opinionated boilerplates when standard, lightweight implementations do the job cleanly.
2. **Comment Discipline:**
   - Write comments sparingly, naturally, and only where non-obvious domain logic warrants explanation.
   - Comments should explain "why", not restate what the code clearly does.
   - Avoid decorative separators (such as line banners or symbols), markdown tags, or essays inside code files.
   - Avoid dashes or hyphens inside comments unless mathematically required. Write clean, direct English.
3. **Repository Cleanliness:**
   - Keep root and source folders clean of temporary files, screenshots, logs, or duplicates.
   - Maintain a synchronized environment template containing only actively utilized variables with dummy values. Never track active secret files.

---

## 4. Verification, Testing & Reviews

1. **Continuous Verification:**
   - Test each unit against a running database and live environment as soon as it is written.
   - Validate both standard use cases and failure scenarios (such as invalid inputs, duplicate keys, foreign key violations, and cascading rules).
2. **Review Before Signing Off:**
   - Periodically inspect git status, staged diffs, and codebase structure to ensure no orphan files or stray dependencies exist.
   - Walk through the execution path from entry point to database to verify that data flows correctly without side effects.
3. **Test Helpers and Documentation:**
   - Provide lightweight, standalone helper scripts to quickly populate test data so anyone testing the system can verify flows in one command.
   - Maintain concise, factual documentation covering prerequisites, environment setup, database setup, and instructions to run and test the application.
4. **User Feedback and Checkpoint Reporting:**
   - After completing each major development step, provide a clear, concise report summarizing what was built, what was tested, and what changed.
   - Proactively request user feedback before advancing to the next step so the user remains fully in the loop.

## 5. Project Constraints (non negotiable)

1. Appendix A field names and types are fixed. Never rename, remove or retype them. Extension fields must be listed in DECISIONS.md.
2. packages/core imports nothing from express, mongoose, mongodb, next or other packages. A test enforces this.
3. Schedule allocation and coverage comparison are pure functions with no model calls.
4. Ids are assigned by code and never reused inside a kit. Use a stored counter, not max plus one.
5. Job description text and fetched page text are untrusted. They go through wrapUntrusted, and every model output is schema validated.
6. Private and loopback hosts are blocked unless the CLI process sets ALLOW_PRIVATE_HOSTS.
7. Never state a company fact missing from a fetched source. Never add a requirement without evidence in the job description.
8. The LLM client is injected. Unit tests never use the network.

## 6. Scope And Approval Gates

1. Before each step, post a short plan: files, functions, tests, edge cases, open questions. Wait for approval.
2. Work only on the approved step. No refactors of earlier steps and no extra features.
3. New dependencies need approval with name, purpose, size and alternative.
4. Changes to DECISIONS.md, the schema or any prompt need approval. Show prompts in full in the report.
5. If the spec is ambiguous, stop and ask.
6. Never weaken, skip or delete a test to make code pass.

## 7. Definition Of Done For Every Step

1. npm run check passes (typecheck, lint, tests).
2. New behaviour has tests including failure cases. Break the code once on purpose and confirm a test fails.
3. .env.example, DECISIONS.md and README notes are in sync.
4. git status is clean with no generated files or secrets staged.
5. The report lists files changed, tests added, total passing, commands run with results, deviations from DECISIONS.md, known gaps and what to verify by hand.
6. Tag the commit checkpoint-step-N.

## 8. Live LLM And Quota Discipline

1. Live model calls only in npm run test:live, never in npm test.
2. Provide a dev only response cache keyed by prompt hash, off by default.
3. Log calls per run. Stop and ask if a session exceeds 100 live calls.
4. Never print keys, full job descriptions or full page text in logs.

## 9. Traceability

Maintain REQUIREMENTS.md with one row per requirement in the brief: status, code location, test name. Update it at every checkpoint.
