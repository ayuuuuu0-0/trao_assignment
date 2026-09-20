---
name: frontend
load_when: building pages, forms, progress view, kit viewer or fixing accessibility and states
depends_on: [00-rules, 50-kit-ops]
related: [42-auth-server, 52-practice]
code: packages/web
---

# Frontend

## 7.1 Structure and state boundaries

**Pages** (Next.js App Router):

| Route                 | Purpose                                                                        |
| --------------------- | ------------------------------------------------------------------------------ |
| `/login`, `/register` | Auth forms                                                                     |
| `/kits`               | Kit list with status, plus the create form and bulk upload                     |
| `/kits/[id]`          | Viewer and builder, with tabs for Brief, Role, Questions, Flashcards, Schedule |
| `/kits/[id]/practice` | Practice mode                                                                  |

**Component groups** (a starting list you can rename):

- Layout: `AppShell`, `ProtectedRoute`, `SaveIndicator`, `ErrorBanner`, `EmptyState`, `ConfirmDialog`.
- Create: `CreateKitForm`, `BulkUpload`, `BulkResultList`.
- Progress: `GenerationProgress`, `StepList`, `SourceList`.
- Viewer: `KitTabs`, `BriefPanel`, `RolePanel`, `RequirementRow`, `SchedulePanel`, `DayCard`.
- Builder: `QuestionBank`, `CategorySection`, `QuestionCard`, `InlineEdit`, `MoveMenu`, `RegenerateButton`, `FlashcardList`, `FlashcardEditor`.
- Practice: `PracticeSession`, `FlashcardStep`, `ConfidenceButtons`, `CoveragePanel`.

**State boundaries**:

- Server state (kit, job, practice records): a data-fetching library such as TanStack Query or SWR.
- The kit currently being edited: one reducer (`kitReducer`) that calls the same pure operations as the server (see 7.6). This gives instant edits and one place to test.
- Form state and open or closed UI state: local to the component.
- The debounced save queue: one hook (`useAutosave`) that owns pending edits.

- **AGENT**: scaffold the routes and the component files.
- **YOU**: the component boundaries, in a short README paragraph. You need to explain why each piece of state lives where it lives.

## 7.2 Authentication pages

- **AGENT**: login and register forms with client-side validation, a `ProtectedRoute` wrapper, redirect on `401`.
- **GUIDE (expired session)**: a `401` during editing must not throw away the user's unsaved changes. Show a modal "Your session expired. Sign in to save your changes" with a login form in place. After a successful login, flush the pending save queue. Do not navigate away first.

## 7.3 Creating kits

**Brief**: a textarea for the job description, a field for the company website, a days field, and a way to prepare more than one role (pasting again, or uploading a file of description-and-company pairs).

- **AGENT**: the form, client-side validation matching 6.14 limits, a file upload control, a progress redirect after submit.
- **YOU**: the upload file format. Recommended: a JSON array using the batch case shape without `id`: `[ { "jd": "...", "company_url": "...", "days": 5 } ]`. CSV breaks on multi-line descriptions. Set a row limit (for example 10), because each row costs 8 to 12 model calls.
- **GUIDE (bulk behaviour)**: validate every row and report errors per row before creating anything. Create one kit per valid row, queue them through the shared limiter, and show a result list where each row is `queued`, `generating`, `ready`, `partial` or `failed`. One failed row never blocks the others.
- **GUIDE (duplicates in the UI)**: when the server answers with an existing kit, show "You already have this kit" with links to open it or create a new copy.

## 7.4 Generation progress

**Brief**: watch the kit being generated with visible progress and clear failure states.

- **AGENT**: a progress view that polls `GET /api/jobs/:id`.
- **GUIDE (spec)**:
  - List the pipeline steps with a state per step: pending, running, done, skipped, failed. Show elapsed time.
  - Show sources as they resolve: each page with its label (`hiring`, `about`, `other`), and each skipped page with its reason ("blocked by robots.txt", "timed out", "not HTML").
  - Tell the user they can leave the page. The kit keeps generating, and the kit list shows its status.
  - On step failure, show the message and a Retry button that resumes from that step (6.15).
  - **A partial kit displays as partial, not as an error.** Use a neutral banner: "Kit ready with gaps" and list the warnings.
  - If polling itself fails, show "Connection lost, retrying" and keep polling. The job continues on the server.
- **YOU**: the exact wording for the two honest states. Suggested starting text:
  - No hiring page: "We found no page describing how this company hires. Questions follow a standard interview mix."
  - Thin description: "This job description is short, so only 2 requirements could be extracted. The kit is small on purpose. Paste the full posting for a fuller kit."

## 7.5 Kit viewer

- **AGENT**: tabbed layout and read-only rendering of each section.
- **GUIDE (empty and warning states)**: every section defines its empty state. Brief: "No company information could be retrieved." Questions in a category: "No questions in this category yet. Add one or regenerate." Flashcards: "No flashcards yet." Show the `warnings` list near the top of the kit. Show coverage status (for example "All 7 must-have requirements covered") and mark any uncovered requirement.

## 7.9 Interaction design and accessibility (10 points)

- **AGENT**: Tailwind styling, responsive layout, ARIA labels.
- **GUIDE (checklist to give the agent, then verify yourself)**:
  - Every form control has a visible label and an error message linked with `aria-describedby`.
  - Focus order follows visual order. Visible focus ring on everything focusable. A skip-to-content link.
  - Tabs follow the ARIA tabs pattern with arrow-key navigation.
  - Dialogs trap focus, close on Escape and return focus to the trigger.
  - Progress and save status live in an `aria-live="polite"` region.
  - Nothing important is hover-only. Touch targets are at least 44 by 44 pixels.
  - Layout works at 375 px wide: tabs scroll or become a select, long text wraps, tables scroll inside their own container, no sideways page scroll.
  - Text contrast passes 4.5 to 1. Respect `prefers-reduced-motion`.
- **YOU (verify by hand, 15 minutes)**: (1) put the mouse away and complete the full flow by keyboard: register, create a kit, edit a question, move it to another category, regenerate, practise cards. (2) View every screen at 375 px. (3) Confirm each state exists: loading, empty and error for the kit list, the progress view, each kit section and practice.

**State catalogue** (build all of these):

| Screen     | Loading                 | Empty                                             | Error                                 |
| ---------- | ----------------------- | ------------------------------------------------- | ------------------------------------- |
| Kit list   | Skeleton rows           | "No kits yet. Create your first one."             | "Could not load your kits" with Retry |
| Progress   | Step list with spinners | n/a                                               | Step failure with Retry               |
| Brief      | Skeleton                | "No company information could be retrieved."      | Save failure indicator                |
| Questions  | Skeleton                | Per-category empty text                           | Regeneration failure keeps old items  |
| Flashcards | Skeleton                | "No flashcards yet."                              | Save failure indicator                |
| Schedule   | Skeleton                | "No days scheduled."                              | Warning when over capacity            |
| Practice   | Skeleton                | "No flashcards to practise. Add some in the kit." | Save failure with retry               |

## Done when
- Every entry in the state catalogue (loading, empty, error) exists.
- The full flow works by keyboard only, including move up, move down and move to category.
- Every screen works at 375 px wide.
- The save indicator shows Saving, Saved and Could not save.
- An expired session shows an in-place sign-in and flushes pending edits after login.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
