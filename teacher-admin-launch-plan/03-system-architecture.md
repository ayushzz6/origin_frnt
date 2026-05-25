# System Architecture

## High-Level Architecture

```text
Browser / Mobile
  -> Next.js app (`new-frontend`)
       - auth and session cookies
       - route protection and RBAC
       - teacher/admin/student UI
       - public API boundary
       - CRUD orchestration
       - service clients
       - safe response shaping
  -> Postgres + pgvector
       - users
       - workspaces
       - batches
       - content
       - assessments
       - analytics snapshots
       - Origin AI memory
       - import jobs
  -> Redis / Upstash
       - room codes
       - temporary presence
       - short-lived availability caches
       - queue helper if needed
  -> Cloudflare R2
       - question images
       - imported documents
       - study material files
       - workspace logos
  -> Python services behind internal auth
       - origin-ai
       - grader-service
       - analytics-service
       - document-import-service (recommended new service)
```

Browser traffic should continue to go through Next.js only. Python services should remain private/internal.

## Existing Services To Reuse

### `grader-service`

Keep this source-agnostic. It already accepts a `QuestionSnapshot` and submitted answer.

Required extension:

- Make sure snapshots can come from:
  - `ogcode_questions`,
  - `content.question_versions` from teacher Question Bag,
  - mixed tests.
- Preserve `answer_spec` support for numerical, symbolic, equation, units, matrix, and subjective.

No separate teacher grader is needed.

### `analytics-service`

Current responsibilities already match teacher needs:

- custom test generation from OGCode,
- topic analytics,
- weak/strong topics,
- DPP plans,
- DPP progress.

Required extensions:

- accept `workspace_id`, `batch_id`, `assessment_test_id`, and `question_source` in analysis requests,
- generate custom tests from:
  - OGCode only,
  - Question Bag only,
  - mixed OGCode plus Question Bag,
  - weak-topic constrained sets,
- return batch-ready aggregates,
- write or return enough data for `analytics.batch_topic_snapshots`, `analytics.student_topic_profiles`, and leaderboard snapshots.

### `origin-ai`

Current Origin AI already uses stored page solution before model generation.

Required extensions:

- accept teacher/institute attribution in page context,
- read public OGCode full solutions from `content.question_versions.full_solution`,
- support workspace-private question help for enrolled students if the question comes from a batch/test/room they are allowed to access,
- never reveal private teacher Question Bag solution outside assigned context,
- use stored full solution first for published OGCode questions to reduce token generation.

### Existing Study Rooms

Current `rooms.*` supports:

- room creation,
- invite code,
- lobby,
- participants,
- timer,
- configured custom test,
- leaderboard.

Required extensions:

- add `workspace_id`, `batch_id`, `teacher_test_id`, and `room_kind`,
- allow teacher/admin to create teacher-scoped rooms,
- allow batch-restricted joins,
- allow tests from Question Bag, OGCode, or mixed selection,
- preserve current student-created rooms.

## Recommended New Service

### `document-import-service`

Document import should become a separate service rather than a large Next.js route.

Reason:

- PDF parsing, OCR, page rendering, vision extraction, and AI reconciliation are long-running and dependency-heavy.
- Vercel route limits and cold starts are a poor fit for large imports.
- This pipeline needs retries, progress, diagnostics, and review states.
- It should scale separately from normal app traffic.

Responsibilities:

- fetch source document from R2,
- classify document,
- extract text and layout,
- run deterministic parser,
- run OCR or multimodal extraction when needed,
- reconcile outputs,
- enrich metadata,
- verify,
- write draft questions or review-required artifacts,
- store diagnostics and cost.

Suggested runtime:

- FastAPI service with worker queue.
- Use Postgres import job table as source of truth.
- Use Celery/Redis, QStash, Cloud Tasks, or a simple worker loop depending on deployment target.
- Service called only by Next.js internal token or by queue with signed jobs.

## Low-Level Runtime Flows

### 1. Institute Code Availability

```text
Teacher signup UI
  -> Next.js /api/teacher/workspaces/codes/check?code=...
  -> normalize code
  -> reject reserved/offensive codes
  -> query app.workspace_codes active/reserved partial unique index
  -> return available/unavailable/suggestion
```

Do not rely only on client-side checks. Signup must still insert through a transaction and handle unique conflicts.

### 2. Institute Signup

```text
Signup submit
  -> Next.js server action/API
  -> create origin_users teacher row
  -> create app.teacher_workspaces row
  -> create app.workspace_members owner row
  -> create app.workspace_codes active student_join code
  -> create auth session
  -> redirect to teacher onboarding/home
```

All rows should be created in one Postgres transaction.

### 3. Student Joins Workspace By Code

```text
Student enters code
  -> Next.js /api/student/enrollments/join-code
  -> resolve active app.workspace_codes row
  -> verify workspace active
  -> create app.workspace_student_enrollments
  -> if batch code, create app.batch_members
  -> else keep status = unassigned
  -> notify workspace dashboard
```

### 4. Teacher Assigns Student To Batch

```text
Teacher selects unassigned student
  -> Next.js checks workspace membership permission
  -> verify student enrollment exists
  -> insert app.batch_members rows
  -> update enrollment status to active if first batch assignment
  -> audit event
```

### 5. Manual Question Creation

```text
Teacher opens Question Bag
  -> Next.js validates workspace permission
  -> upload reference assets to R2 through signed/internal upload path
  -> create content.questions row
  -> create content.question_versions v1
  -> link content.question_asset_links
  -> status draft or ready
```

### 6. Document Import

```text
Teacher uploads PDF/DOCX/image
  -> Next.js stores raw file in R2 as content.assets
  -> insert import.document_import_jobs queued
  -> enqueue document-import-service worker
  -> UI polls/subscribes to job progress
  -> service parses and verifies
  -> service creates content.questions in needs_review/ready
  -> teacher reviews and accepts into Question Bag
```

### 7. Publish Question To OGCode

```text
Teacher clicks Publish to OGCode
  -> Next.js validates current version
  -> require hint + full_solution + answer spec + metadata
  -> create content.ogcode_publications submitted
  -> platform admin reviews
  -> publish approved version to OGCode public index/table
  -> Origin AI can use stored full_solution for that question
```

### 8. Teacher Creates Test

```text
Teacher creates test
  -> choose source: Question Bag / OGCode / mixed / random
  -> Next.js resolves question ids and versions
  -> create assessment.tests
  -> create assessment.test_questions snapshots/links
  -> optional assignment to batches/students
  -> optional schedule
```

For compatibility, the first implementation can mirror tests into `analytics.custom_tests` until the app UI is fully migrated to `assessment.tests`.

### 9. Teacher Creates Room Test

```text
Teacher creates room
  -> create rooms.rooms with workspace_id/batch_id/room_kind
  -> generate invite code through existing room code system
  -> configure assessment.tests or analytics custom_test
  -> start room
  -> student submits
  -> grader-service evaluates
  -> analytics-service analyzes
  -> rooms leaderboard and analytics snapshots persist
```

### 10. Student Test Submission

```text
Student submits test
  -> Next.js resolves test and question snapshots
  -> grader-service batch evaluation
  -> persist assessment.test_attempts and assessment.test_answers
  -> analytics-service /v1/tests/analyze with workspace/batch context
  -> persist analytics.test_results and snapshots
  -> update leaderboard snapshots
  -> teacher dashboards read snapshots
```

## Service Integration Contracts

### Analytics Request Additions

Add optional fields to existing `AnalyticsTestAnalysisRequest`:

```ts
{
  workspace_id?: string | null;
  batch_id?: string | null;
  assessment_test_id?: string | null;
  source_type: "student_custom" | "teacher_test" | "teacher_room" | "scheduled_test" | "dpp";
  question_sources?: Array<"ogcode" | "workspace_bag">;
}
```

### Custom Test Generation Additions

```ts
{
  user_id: string;
  workspace_id?: string | null;
  batch_id?: string | null;
  source_pool: "ogcode" | "workspace_bag" | "mixed";
  question_bag_question_ids?: string[];
  subject: string;
  difficulty?: string;
  chapter?: string;
  question_count: number;
  recent_weak_topics: string[];
  attempted_question_ids: string[];
}
```

### Origin AI Page Context Additions

```ts
{
  workspaceId?: string | null;
  batchId?: string | null;
  questionSource?: "ogcode" | "workspace_bag";
  questionVersionId?: string | null;
  contributorAttribution?: {
    name: string;
    logoUrl?: string | null;
  } | null;
  fullSolutionAvailable?: boolean;
}
```

## Data Ownership Boundaries

### Next.js Owns

- auth,
- workspace RBAC,
- code availability and enrollment transactions,
- CRUD for batches/materials/tests/questions,
- route handlers,
- UI response shaping,
- service orchestration,
- audit logging.

### Python Services Own

- grading computation,
- analytics computation,
- document parsing/import computation,
- Origin AI answer orchestration.

### Postgres Owns

- durable state,
- source of truth,
- audit history,
- job progress,
- question versions,
- analytics snapshots.

### R2 Owns

- raw uploaded documents,
- question images and diagrams,
- study material files,
- logos and media.

## Security Model

- All workspace APIs require an authenticated user.
- Every teacher/admin API must resolve an active `workspace_members` row unless platform admin.
- Student content APIs must resolve active workspace enrollment plus batch assignment where relevant.
- Staff invite code and student join code must be separate.
- Workspace code rotation revokes old code and creates a new active code.
- Public OGCode questions can be read by all students.
- Private Question Bag questions can only be used by workspace staff and assigned students in tests/rooms/materials where they have access.
- Service-to-service calls require bearer token and request id.
- Mutating APIs require idempotency keys where duplicate submission is possible.

## Observability

Track:

- workspace signup success/error,
- code availability conflicts,
- enrollment source,
- unassigned student aging,
- batch assignment operations,
- question import job stage timings,
- parser confidence and verifier failures,
- OGCode moderation queue time,
- teacher test generation fallback rate,
- grader-service latency/error rate,
- analytics-service latency/error rate,
- Origin AI stored-solution hit rate for OGCode questions,
- R2 upload failures.

