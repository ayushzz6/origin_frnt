# Implementation Roadmap

This roadmap assumes no coding starts until the planning pack is reviewed. Each phase should ship behind feature flags where possible so beta student-side behavior remains stable.

## Phase 0: Planning, Contracts, and Migration Strategy

Deliverables:

- approve workspace model,
- approve database target schema,
- approve service boundaries,
- approve phased route layout,
- decide migration naming convention,
- decide first feature flags.

Acceptance:

- no open ambiguity on personal vs institute modeling,
- no open ambiguity on student enrollment vs batch membership,
- no open ambiguity on private Question Bag vs public OGCode publishing,
- no open ambiguity on document import being a separate service or temporary Next.js worker.

## Phase 1: Workspace Foundation and RBAC

Build:

- `app.teacher_workspaces`,
- `app.workspace_members`,
- `app.workspace_codes`,
- workspace creation service,
- workspace permission helpers,
- platform admin override helper,
- audit event helper,
- route policy updates.

UI:

- minimal teacher workspace shell,
- workspace switcher if user belongs to more than one workspace,
- settings page for personal/institute basics.

Tests:

- workspace owner can access workspace,
- non-member cannot access workspace,
- admin override works,
- disabled member cannot mutate,
- personal teacher signup creates personal workspace,
- institute signup creates institute workspace.

Acceptance:

- every teacher API can require workspace context and role.

## Phase 2: Teacher/Institute Onboarding and Organization Codes

Build:

- teacher entry screen: personal vs institute,
- institute organization code availability endpoint,
- code normalization and reserved-code checks,
- transactional signup for institute workspace,
- default code generation for personal teacher workspace,
- code rotation/revocation,
- staff invite code foundation.

UI:

- Gmail-like organization code availability feedback,
- institute signup additional section,
- code management panel,
- copy/share code.

Tests:

- duplicate active code rejected,
- revoked code no longer enrolls,
- rotated code works,
- reserved code rejected,
- concurrent same-code signup has one winner.

Acceptance:

- teacher/institute can create workspace and manage a student join code.

## Phase 3: Student Enrollment and Batch Management

Build:

- join workspace by code,
- unassigned student queue,
- batch CRUD,
- batch staff assignment,
- batch student assignment,
- multiple batch membership,
- student access gating for workspace/batch content.

UI:

- students page with unassigned and active sections,
- batch list/detail,
- assign to multiple batches,
- batch roster,
- basic student profile drawer.

Tests:

- student joins workspace with code and appears unassigned,
- teacher assigns student to batch,
- student can be in multiple batches,
- student cannot see workspace content until enrolled and assigned where required,
- teacher cannot manage another workspace's batch.

Acceptance:

- institute can enroll students and organize them into batches.

## Phase 4: Question Bag Manual CRUD and Assets

Build:

- `content.assets`,
- `content.questions`,
- `content.question_versions`,
- `content.question_asset_links`,
- R2 upload path for teacher assets,
- manual question create/edit/version,
- answer spec support,
- reference image/table attachment,
- question search/filter.

UI:

- Question Bag list,
- manual question editor,
- reference asset uploader,
- version history drawer,
- status filters.

Tests:

- create MCQ/MSQ/numerical/matrix/subjective question,
- edit creates version instead of mutating old version,
- image metadata stored in Postgres and bytes in R2,
- non-member cannot access private questions,
- question cannot be used in test if missing required answer fields.

Acceptance:

- teacher can maintain a private question bank.

## Phase 5: Teacher Tests With Existing Grader and Analytics

Build:

- `assessment.tests`,
- `assessment.test_questions`,
- assignment to batch/student,
- question resolver for OGCode and Question Bag,
- test snapshot builder,
- submit path using `grader-service`,
- analytics request with workspace/batch context,
- compatibility adapter to existing `analytics.custom_tests` if needed.

UI:

- create test wizard,
- choose Question Bag / OGCode / mixed,
- random selection from Question Bag,
- schedule/duration/scoring controls,
- student assigned test list,
- result page.

Tests:

- teacher creates test from private questions,
- teacher creates mixed OGCode plus Question Bag test,
- student assigned to batch can take test,
- unassigned student cannot take batch test,
- grader-service receives correct snapshots,
- analytics-service persists weak topic data.

Acceptance:

- scheduled and assigned teacher tests work end to end.

## Phase 6: Teacher Rooms

Build:

- extend `rooms.rooms` with workspace/batch/test fields,
- teacher room create,
- batch-restricted room join,
- teacher-configured room test from Question Bag/OGCode/mixed,
- timer support using existing server-anchored timer,
- room leaderboard persistence.

UI:

- teacher rooms list,
- create room flow,
- configure test drawer,
- invite code card,
- live participants,
- leaderboard history.

Tests:

- existing student rooms still work,
- teacher room requires workspace permission,
- batch-only room blocks non-batch students,
- room test submits through grader and analytics,
- leaderboard stores results.

Acceptance:

- teacher can run live room tests for enrolled students.

## Phase 7: Study Materials

Build:

- `content.study_materials`,
- `content.study_material_assets`,
- batch/student material assignment,
- material visibility checks,
- R2 upload path for PDF/DOCX/images.

UI:

- study material library,
- upload form,
- batch assignment,
- student batch material view.

Tests:

- material upload stored in R2,
- batch student can view assigned material,
- unassigned student cannot view,
- archive hides material without deleting audit.

Acceptance:

- teachers/institutes can distribute study docs to batches.

## Phase 8: Teacher Analytics

Build:

- analytics-service request extensions,
- batch topic snapshot persistence,
- student topic profile persistence,
- leaderboard snapshots,
- teacher analytics read APIs.

UI:

- batch radar chart,
- hot weak topics,
- previous test leaderboard,
- weak students list,
- individual strengths/weaknesses profile,
- filters by batch/test/subject/date.

Tests:

- analytics snapshots are created after teacher test,
- radar data reads from snapshots,
- leaderboard history preserved,
- privacy checks prevent cross-workspace access.

Acceptance:

- teacher can identify batch weak topics and individual weak students from previous tests.

## Phase 9: OGCode Publishing, Moderation, and Republish

Build:

- `content.ogcode_publications`,
- publish validation rules,
- mandatory hint/full solution enforcement,
- admin moderation queue,
- publish-to-OGCode sync adapter,
- attribution display on OGCode,
- edit and republish version flow,
- Origin AI stored-solution lookup update.

UI:

- publish to OGCode action in Question Bag,
- missing requirements checklist,
- admin moderation screen,
- OGCode contributor badge/logo on student question view,
- edit/republish controls.

Tests:

- missing full solution blocks OGCode submission,
- missing hint blocks OGCode submission,
- admin approval publishes public version,
- edit creates new version,
- old attempts keep old snapshot/version,
- Origin AI reads stored full solution before generation.

Acceptance:

- teachers/institutes can contribute public OGCode questions safely.

## Phase 10: Document Import Service and Review UX

Build:

- `document-import-service`,
- `import.document_import_jobs`,
- source file R2 storage,
- classifier,
- parser adapters,
- multimodal/OCR adapter,
- verifier,
- persistence to Question Bag drafts,
- job progress API,
- review-required states.

UI:

- import upload in Question Bag and admin OGCode,
- job progress,
- review dashboard,
- side-by-side source preview,
- manual diagram attach/crop,
- bulk accept ready questions,
- accept partial with explicit confirmation.

Tests:

- clean text import exact,
- hard PDF review-required,
- missing diagrams flagged,
- answer mismatch flagged,
- failed import does not create valid-looking questions,
- regression corpus in CI.

Acceptance:

- teacher/admin can import questions with evidence and human review safeguards.

## Phase 11: Admin Control Center

Build:

- workspace/institute admin APIs,
- global user and workspace search,
- code revocation,
- workspace suspension,
- staff role management,
- OGCode moderation,
- import job monitor,
- service health dashboards,
- audit log viewer.

UI:

- admin workspace list/detail,
- teachers/institutes tab,
- student tab,
- content moderation tab,
- import jobs tab,
- service health panel,
- audit events.

Tests:

- admin can suspend workspace,
- suspended workspace cannot create content/tests,
- admin can revoke leaked code,
- admin can approve/reject OGCode submissions,
- admin actions write audit events.

Acceptance:

- platform admin can control student and teacher/institute surfaces.

## Phase 12: Paid Direct Enrollment and Marketplace

Build:

- institute public profiles,
- workspace offerings,
- payment provider integration,
- enrollment orders,
- automatic enrollment after successful payment,
- optional auto batch mapping.

UI:

- student marketplace,
- institute profile page,
- offering checkout,
- teacher enrollment order list.

Tests:

- payment success creates enrollment,
- payment failure does not create enrollment,
- duplicate purchase handled idempotently,
- refunds/suspensions do not corrupt batch history.

Acceptance:

- students can directly enroll in partner institutes from ORIGIN.

## Phase 13: Production Hardening

Build:

- feature flags,
- rate limits,
- import queue backpressure,
- audit coverage,
- data export tools,
- service alerting,
- R2 lifecycle rules,
- backup/restore runbooks,
- admin incident controls.

Tests:

- load tests for code join,
- load tests for batch analytics reads,
- service outage fallback tests,
- R2 upload failure tests,
- import worker retry tests,
- permission fuzz tests.

Acceptance:

- launch checklist passes for teacher, institute, admin, and existing student flows.

## Recommended First Coding Slice

When coding starts, do not begin with the full UI.

Start with:

1. workspace schema and RBAC,
2. personal/institute workspace creation,
3. organization code availability and creation,
4. student join code enrollment,
5. batch CRUD and assignment.

This creates the product foundation that every later feature depends on.

