---
name: auth-and-server
load_when: implementing authentication, the Express app, Mongo models or API routes
depends_on: [00-rules, 10-kit-schema]
related: [40-jobs-duplicates, 50-kit-ops]
code: packages/server
---

# Auth and server

## 6.1 Authentication

**Brief**: secure registration, login and logout with sessions. A signed-out visitor cannot reach protected pages or endpoints. Users read and modify only their own kits. Expired or invalid sessions are handled sensibly. Email verification and password reset are out of scope.

- **AGENT**: password hashing (bcrypt or argon2), register, login, logout and `me` routes, auth middleware, request validation, login rate limiting, `helmet`.
- **GUIDE (ownership)**: every kit, job and practice query filters by `userId` inside the data layer, not only in the route handler. Return `404` when a user requests another user's kit, so the response does not confirm the kit exists. Ask for a test where user A requests user B's kit and gets 404 on read, update, delete and regenerate.
- **GUIDE (errors)**: an expired or invalid session returns `401` with code `SESSION_EXPIRED` or `UNAUTHENTICATED`. Login failures return one generic message for wrong email and wrong password.
- **YOU (D11)**: session mechanism. If the frontend and backend sit on different domains, browsers block cross-site cookies unless you set `SameSite=None; Secure` and CORS credentials correctly, and some browsers still restrict them. The simplest fix is to proxy: configure Next.js `rewrites` so `/api/*` on the frontend domain forwards to the backend. The cookie becomes first-party and you avoid the cross-site problem. Decide this on day 1, since finding out at deployment costs hours.

## 6.14 Validation

**Brief**: validate incoming requests, and validate a generated kit against the expected structure before saving.

- **AGENT**: a Zod (or Ajv) schema for the kit, request schemas for each endpoint, structured error responses `{ error: { code, message, details } }`.
- **GUIDE**: `validateKit(kit)` runs the schema check and then the cross-reference checks from 3.1 (unique ids, requirement references, schedule references, day count, integer minutes, difficulty range, must coverage). It returns a list of problems, not a boolean, so failures are readable. The server calls it before every save. The pipeline calls it before returning. Generate the schema from Appendix A pasted verbatim, not from the agent's own idea of the structure.
- **Input limits to set**: job description up to 20,000 characters, company URL up to 2,048 characters, days an integer within a range you document (1 to 90 recommended). Accept numeric strings such as `"5"` and coerce them. Reject everything else with `INVALID_INPUT`.

## Suggested API surface (proposal, needs user approval before building)

| Method and path | Purpose |
|---|---|
| POST /api/auth/register, /login, /logout | Session lifecycle |
| GET /api/auth/me | Current user or 401 SESSION_EXPIRED |
| POST /api/kits | Validate, apply the duplicate rule, create kit and job, return ids |
| POST /api/kits/bulk | Validate every row, create one kit per valid row |
| GET /api/kits, GET /api/kits/:id, DELETE /api/kits/:id | List, read, delete own kits |
| GET /api/jobs/:id, POST /api/jobs/:id/retry | Progress and resume |
| PATCH /api/kits/:id/questions/:qid, POST /api/kits/:id/questions, DELETE /api/kits/:id/questions/:qid | Per-item edits |
| POST /api/kits/:id/reorder, POST /api/kits/:id/move | Per-operation changes |
| POST /api/kits/:id/regenerate | Body { section, category? }, returns a job |
| PATCH /api/kits/:id/flashcards/:fid and matching POST and DELETE | Flashcard edits |
| POST /api/kits/:id/practice, GET /api/kits/:id/practice/queue | Ratings and next session |

Mongo collections: users (unique email), sessions (TTL index), kits (userId, updatedAt, inputHash, version), jobs (kitId), practice (unique userId, kitId, cardId). Every query filters by userId inside the data layer.

## Done when
- Ownership tests pass: user A gets 404 on read, update, delete and regenerate of user B kits.
- Expired or invalid sessions return 401 with SESSION_EXPIRED or UNAUTHENTICATED.
- Login has one generic failure message and a rate limit.
- Every request body is validated and errors use { error: { code, message, details } }.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
