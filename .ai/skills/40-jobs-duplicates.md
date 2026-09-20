---
name: jobs-and-duplicates
load_when: implementing background generation, job records, resume, retry or duplicate detection
depends_on: [00-rules, 42-auth-server]
related: [30-llm-client, 41-batch-cli]
code: packages/server/src/jobs
---

# Jobs and duplicates

## 6.15 Jobs, long-running generation and duplicates

**Brief**: think about a run that takes ninety seconds, fails halfway, or is triggered twice for the same posting. Describe your approach in the README.

- **AGENT**: a `jobs` collection, a background runner, a status endpoint.
- **GUIDE (spec)**:
  - `POST /api/kits` validates the input, computes the D7 hash, applies the duplicate rule, creates a kit record with status `generating` and a job record, then returns immediately with `{ kitId, jobId }`. The pipeline runs in the background and never inside the request.
  - The job record stores: `status` (`queued`, `running`, `succeeded`, `partial`, `failed`), per-step state (`pending`, `running`, `done`, `skipped`, `failed`) with timestamps and a short detail string, the output of each finished step, the fetched and skipped pages with reasons, and an LLM call trace.
  - After each step completes, persist its output. `runPipeline` accepts a checkpoint of finished step outputs and skips them. `POST /api/jobs/:id/retry` resumes from the failed step.
  - `GET /api/jobs/:id` returns the current state. The frontend polls every 1.5 seconds and slows to 5 seconds after a minute.
  - A background job that runs inside the server process dies when the server restarts. On boot, find jobs still marked `running` with an old heartbeat, mark them `interrupted`, and let the user resume.
  - Timeouts: 60 seconds per model call, 60 seconds for the crawl, 5 minutes for a whole job.
  - Status `partial` means a kit exists with recorded gaps. It is not an error.
- **YOU**: D7 behaviour, and the timeouts.

## D7. Duplicate submissions

The same description and company submitted twice.

- **Key**: SHA-256 of the normalised job description (trimmed, whitespace collapsed, lowercased), the normalised company URL, the days value and the user id.
- **Recommended behaviour**:
  - Same key with a job still running: return that running job. Do not start a second one.
  - Same key with a finished kit: return the existing kit with a message "You already have this kit" and offer a "Create a new copy" action that sets a `force` flag.
  - Same job description and URL with different days: this is a new kit, but reuse the cached crawl results for that URL (cache pages for a short time, for example 24 hours) so you do not re-fetch and re-clean.
- **Record**: the key, the three behaviours, the cache duration.

## Done when
- A job persists each step output. A retry resumes from the failed step and skips finished ones.
- The duplicate rule from D7 is tested for a running job and for a finished kit.
- On boot, stale running jobs are marked interrupted.
- partial status means a kit exists with recorded gaps.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
