# Engineering Guidelines & Agent Instructions

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
   - Write professional, concise, and outcome-oriented commit messages.
   - State what the change achieves from a functional or architectural perspective.
   - Avoid hyphens, em-dashes, or awkward formatting in commit messages.
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
