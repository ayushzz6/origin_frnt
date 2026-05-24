# Load tests

k6 scripts that model launch-day traffic shapes for the teacher / institute /
admin surfaces. **Not wired into CI** — k6 isn't in the build image. Run them
locally against a staging deployment before launch.

## Prerequisites

```bash
brew install k6   # macOS; see https://k6.io/docs/get-started/installation/ for other OSes
```

You'll also need:

- A staging or preview deployment that's a faithful clone of production
  (same env vars, same microservice URLs).
- Real session cookies for one **student** account (for `code-join.k6.js`)
  and one **teacher** account (for `batch-analytics.k6.js`). Open
  DevTools → Application → Cookies and copy `origin_access` + `origin_csrf`.

## Running

### `code-join.k6.js`

Simulates an institute distributing a join code to ~50 students in a single
ramp. Verifies idempotent dedup + 429 budget under load.

```bash
BASE_URL=https://staging.o3origin.com \
  WORKSPACE_CODE=ABCDEF \
  STUDENT_TOKEN=<origin_access> \
  STUDENT_CSRF=<origin_csrf> \
  k6 run tests/load/code-join.k6.js
```

Pass criteria (set as k6 thresholds):

- `origin_join_success` rate > 95%
- `origin_join_duration_ms` p95 < 800ms
- `origin_join_rate_limited` rate < 10% (the 60 req/min/user mutation cap
  shouldn't fire at this VU count for unique users)

### `batch-analytics.k6.js`

Simulates 25 concurrent teachers reviewing batch analytics. Verifies the
analytics-snapshot read path stays sub-200ms p95.

```bash
BASE_URL=https://staging.o3origin.com \
  WORKSPACE_ID=ws_... \
  BATCH_ID=batch_... \
  TEACHER_TOKEN=<origin_access> \
  TEACHER_CSRF=<origin_csrf> \
  k6 run tests/load/batch-analytics.k6.js
```

Pre-conditions: the batch must have at least one completed test attempt so
analytics has snapshots to read.

Pass criteria:

- `origin_analytics_success` rate > 98%
- `origin_radar_duration_ms` p95 < 300ms
- `origin_students_duration_ms` p95 < 500ms

## When to run

- Before flipping the launch flag in production (see
  `V1/docs/runbooks/launch-checklist.md`).
- After tuning `ORIGIN_MUTATION_RATE_LIMIT` or
  `DOCUMENT_IMPORT_WORKSPACE_CONCURRENCY`.
- After a microservice change to grader / analytics / origin-ai.

## Adjusting the shape

Both scripts hard-code stage durations and VU counts. If your launch shape is
different (e.g. an institute with 500 students rather than 50), edit the
`stages` array at the top of the file. Keep the thresholds — they're the
contract.

## Limitations

- The scripts use a single auth token per VU type; this means the per-user
  rate limiter is hit harder than it would be in real traffic. If you need
  true many-user simulation, generate a small pool of test accounts and
  pick one per VU at startup.
- They don't exercise the document-import-service worker — that worker is
  hosted separately and has its own load profile (a regression-corpus run
  rather than a synthetic ramp). See `V1/document-import-service/README.md`.
