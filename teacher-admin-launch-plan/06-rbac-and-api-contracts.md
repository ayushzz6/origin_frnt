# RBAC and API Contracts

## Permission Model

### Platform Roles

Existing `origin_users.role` should remain:

- `student`
- `teacher`
- `admin`

Teacher/institute permissions should not be encoded only in `origin_users.role`. They belong to workspace membership.

### Workspace Roles

Recommended workspace roles:

- `owner`: full control, billing later, can delete/close workspace, can manage all staff.
- `admin`: all operational controls except owner-only destructive/billing actions.
- `teacher`: manage assigned batches, create rooms/tests/materials/questions depending on policy.
- `content_manager`: manage Question Bag, imports, study materials, OGCode drafts.
- `analyst`: read analytics, leaderboards, student profiles.
- `support`: read selected student/batch data, no content/test mutation unless explicitly allowed.

### Student Access

Student access is based on:

- active workspace enrollment,
- active batch membership for batch-scoped content,
- direct assignment for student-scoped tests/materials,
- room membership for room-scoped tests,
- public visibility for OGCode.

## Permission Matrix

| Action | Owner | Admin | Teacher | Content Manager | Analyst | Student | Platform Admin |
|---|---:|---:|---:|---:|---:|---:|---:|
| Edit workspace settings | yes | yes | no | no | no | no | yes |
| Manage staff | yes | yes | no | no | no | no | yes |
| Rotate student join code | yes | yes | no | no | no | no | yes |
| View enrolled students | yes | yes | assigned | no | read | self only | yes |
| Assign student to batch | yes | yes | assigned batch | no | no | no | yes |
| Create batch | yes | yes | optional | no | no | no | yes |
| Upload Question Bag question | yes | yes | yes | yes | no | no | yes |
| Import questions | yes | yes | yes | yes | no | no | yes |
| Publish to OGCode | yes | yes | yes | yes | no | no | review/override |
| Create room | yes | yes | yes | no | no | no | yes |
| Create scheduled test | yes | yes | yes | no/optional | no | no | yes |
| View analytics | yes | yes | assigned batch | no | yes | self only | yes |
| Upload materials | yes | yes | yes | yes | no | no | yes |
| Suspend workspace | no | no | no | no | no | no | yes |
| Moderate OGCode | no | no | no | no | no | no | yes |

`assigned` means the staff member must be linked to the batch through `app.batch_staff`, unless workspace policy allows all teachers to see all batches.

## Next.js Route Layout

Suggested frontend routes:

```text
/teacher
/teacher/onboarding
/teacher/workspaces/[workspaceId]
/teacher/workspaces/[workspaceId]/students
/teacher/workspaces/[workspaceId]/batches
/teacher/workspaces/[workspaceId]/batches/[batchId]
/teacher/workspaces/[workspaceId]/question-bag
/teacher/workspaces/[workspaceId]/question-bag/import
/teacher/workspaces/[workspaceId]/question-bag/[questionId]
/teacher/workspaces/[workspaceId]/materials
/teacher/workspaces/[workspaceId]/tests
/teacher/workspaces/[workspaceId]/tests/[testId]
/teacher/workspaces/[workspaceId]/rooms
/teacher/workspaces/[workspaceId]/rooms/[roomId]
/teacher/workspaces/[workspaceId]/analytics
/teacher/workspaces/[workspaceId]/settings

/admin
/admin/users
/admin/workspaces
/admin/workspaces/[workspaceId]
/admin/ogcode/moderation
/admin/import-jobs
/admin/content
/admin/analytics
/admin/monitoring
/admin/financials
/admin/settings
```

## Public API Layout

All examples are Next.js route handlers under `new-frontend/src/app/api`.

### Workspace APIs

```text
GET    /api/teacher/workspaces
POST   /api/teacher/workspaces
GET    /api/teacher/workspaces/[workspaceId]
PATCH  /api/teacher/workspaces/[workspaceId]
POST   /api/teacher/workspaces/[workspaceId]/codes/check
POST   /api/teacher/workspaces/[workspaceId]/codes
POST   /api/teacher/workspaces/[workspaceId]/codes/[codeId]/revoke
```

### Staff APIs

```text
GET    /api/teacher/workspaces/[workspaceId]/members
POST   /api/teacher/workspaces/[workspaceId]/members/invite
PATCH  /api/teacher/workspaces/[workspaceId]/members/[userId]
DELETE /api/teacher/workspaces/[workspaceId]/members/[userId]
```

### Enrollment APIs

```text
POST   /api/enrollments/join-code
GET    /api/teacher/workspaces/[workspaceId]/students
PATCH  /api/teacher/workspaces/[workspaceId]/students/[studentId]
POST   /api/teacher/workspaces/[workspaceId]/students/[studentId]/assign-batches
DELETE /api/teacher/workspaces/[workspaceId]/students/[studentId]/batches/[batchId]
```

### Batch APIs

```text
GET    /api/teacher/workspaces/[workspaceId]/batches
POST   /api/teacher/workspaces/[workspaceId]/batches
GET    /api/teacher/workspaces/[workspaceId]/batches/[batchId]
PATCH  /api/teacher/workspaces/[workspaceId]/batches/[batchId]
DELETE /api/teacher/workspaces/[workspaceId]/batches/[batchId]
GET    /api/teacher/workspaces/[workspaceId]/batches/[batchId]/students
POST   /api/teacher/workspaces/[workspaceId]/batches/[batchId]/students
GET    /api/teacher/workspaces/[workspaceId]/batches/[batchId]/analytics
```

### Question Bag APIs

```text
GET    /api/teacher/workspaces/[workspaceId]/questions
POST   /api/teacher/workspaces/[workspaceId]/questions
GET    /api/teacher/workspaces/[workspaceId]/questions/[questionId]
PATCH  /api/teacher/workspaces/[workspaceId]/questions/[questionId]
POST   /api/teacher/workspaces/[workspaceId]/questions/[questionId]/assets
POST   /api/teacher/workspaces/[workspaceId]/questions/[questionId]/publish-private
POST   /api/teacher/workspaces/[workspaceId]/questions/[questionId]/submit-ogcode
GET    /api/teacher/workspaces/[workspaceId]/questions/[questionId]/versions
```

### Import APIs

```text
POST   /api/teacher/workspaces/[workspaceId]/imports
GET    /api/teacher/workspaces/[workspaceId]/imports
GET    /api/teacher/workspaces/[workspaceId]/imports/[jobId]
POST   /api/teacher/workspaces/[workspaceId]/imports/[jobId]/accept-ready
POST   /api/teacher/workspaces/[workspaceId]/imports/[jobId]/accept-partial
POST   /api/teacher/workspaces/[workspaceId]/imports/[jobId]/cancel
```

### Study Material APIs

```text
GET    /api/teacher/workspaces/[workspaceId]/materials
POST   /api/teacher/workspaces/[workspaceId]/materials
GET    /api/teacher/workspaces/[workspaceId]/materials/[materialId]
PATCH  /api/teacher/workspaces/[workspaceId]/materials/[materialId]
POST   /api/teacher/workspaces/[workspaceId]/materials/[materialId]/assign
DELETE /api/teacher/workspaces/[workspaceId]/materials/[materialId]
```

### Teacher Test APIs

```text
GET    /api/teacher/workspaces/[workspaceId]/tests
POST   /api/teacher/workspaces/[workspaceId]/tests
GET    /api/teacher/workspaces/[workspaceId]/tests/[testId]
PATCH  /api/teacher/workspaces/[workspaceId]/tests/[testId]
POST   /api/teacher/workspaces/[workspaceId]/tests/[testId]/assign
POST   /api/teacher/workspaces/[workspaceId]/tests/[testId]/schedule
POST   /api/teacher/workspaces/[workspaceId]/tests/[testId]/publish
GET    /api/teacher/workspaces/[workspaceId]/tests/[testId]/leaderboard
GET    /api/teacher/workspaces/[workspaceId]/tests/[testId]/analytics
```

### Teacher Room APIs

Prefer extending existing `/api/study-rooms` internals while adding teacher-specific wrappers:

```text
GET    /api/teacher/workspaces/[workspaceId]/rooms
POST   /api/teacher/workspaces/[workspaceId]/rooms
POST   /api/teacher/workspaces/[workspaceId]/rooms/[roomId]/configure-test
POST   /api/teacher/workspaces/[workspaceId]/rooms/[roomId]/start
GET    /api/teacher/workspaces/[workspaceId]/rooms/[roomId]/leaderboard
```

### Admin APIs

```text
GET    /api/admin/workspaces
GET    /api/admin/workspaces/[workspaceId]
PATCH  /api/admin/workspaces/[workspaceId]
POST   /api/admin/workspaces/[workspaceId]/suspend
POST   /api/admin/workspaces/[workspaceId]/restore
POST   /api/admin/workspaces/[workspaceId]/codes/[codeId]/revoke
GET    /api/admin/ogcode/moderation
POST   /api/admin/ogcode/moderation/[publicationId]/approve
POST   /api/admin/ogcode/moderation/[publicationId]/reject
GET    /api/admin/import-jobs
GET    /api/admin/import-jobs/[jobId]
GET    /api/admin/audit-events
```

## Internal Service Contracts

### Service Auth Headers

Every Next.js to Python call should include:

```text
Authorization: Bearer <internal-service-token>
X-Request-Id: <uuid>
Idempotency-Key: <uuid>   # for mutations/jobs
```

### `document-import-service`

```text
POST /v1/import-jobs/[jobId]/run
GET  /health
GET  /ready
```

The service reads job data from Postgres. Keeping the body small avoids sending large files through Next.js again.

Run request:

```json
{
  "job_id": "imp_...",
  "requested_by": "user_...",
  "workspace_id": "ws_..."
}
```

### `analytics-service` Extensions

```text
POST /v1/custom-tests/generate
POST /v1/tests/analyze
POST /v1/dpps/analyze-attempt
POST /v1/batches/summarize
```

`/v1/batches/summarize` can be added later to recompute batch snapshots after backfills.

### `grader-service`

No new endpoint required if batch evaluation remains source-agnostic:

```text
POST /v1/evaluate
POST /v1/evaluate-batch
```

### `origin-ai`

No separate teacher endpoint required initially. Extend existing page context.

```text
POST /api/v1/chat/respond
POST /api/v1/voice/respond
```

## Authorization Helpers To Add

Suggested server helpers:

```ts
requireWorkspaceMember(request, workspaceId, roles?)
requireWorkspaceOwnerOrAdmin(request, workspaceId)
requireBatchAccess(request, workspaceId, batchId)
requireStudentWorkspaceEnrollment(request, workspaceId)
requireStudentBatchMembership(request, workspaceId, batchId)
requireQuestionAccess(request, questionId, mode)
requirePlatformAdmin(request)
```

Each helper should:

- authenticate request,
- check role/membership,
- check workspace status,
- return hydrated user and workspace context,
- throw structured `AuthzError`.

## Idempotency Rules

Use idempotency keys for:

- signup workspace creation,
- code rotation,
- student join code,
- batch assignment,
- test submission,
- import job creation,
- publish to OGCode,
- payment order creation later.

Store idempotency entries either in Postgres or use deterministic unique constraints where possible.

## Audit Events

Audit these actions:

- workspace created/updated/suspended/restored,
- staff invited/role changed/disabled,
- code created/revoked/rotated,
- student enrolled/assigned/removed/suspended,
- batch created/updated/archived,
- question created/edited/versioned/deleted,
- import job accepted/failed/partial accepted,
- OGCode submitted/approved/rejected/published/archived,
- test published/scheduled/closed,
- admin override actions.

Audit should include request id and entity ids. Avoid storing raw secrets or full files.

