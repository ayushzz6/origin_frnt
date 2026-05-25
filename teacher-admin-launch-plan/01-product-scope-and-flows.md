# Product Scope and Flows

## User Types

### Platform Admin

Platform admins control both student and teacher/institute surfaces:

- user management,
- workspace/institute verification,
- organization code moderation,
- OGCode question moderation,
- question import job monitoring,
- global content and taxonomy,
- analytics across students, teachers, institutes, batches, and services,
- finance and future paid enrollments,
- service health and audit trails.

### Personal Teacher

A personal teacher is a single educator workspace. They can:

- create batches,
- enroll students through a teacher code or manual invite,
- assign students to one or more batches,
- create and manage a private Question Bag,
- upload study materials,
- create rooms for live tests,
- schedule tests,
- see batch and student analytics,
- publish selected questions to OGCode after adding mandatory hints and full solutions,
- invite a maintainer later if they want help managing the workspace.

### Institute / Coaching Center

An institute is a multi-staff workspace. It supports:

- organization code chosen during signup,
- multiple staff credentials,
- role-based access,
- student enrollment through organization code,
- unassigned enrolled student queue,
- batches,
- shared Question Bag,
- shared study materials,
- rooms,
- scheduled tests,
- teacher-level attribution,
- institute-level analytics,
- future direct app-based paid enrollments.

### Student

A student can:

- join a teacher/institute using an organization code,
- later enroll through in-app paid direct enrollment,
- be assigned to multiple batches,
- access batch-specific content, tests, rooms, study materials, and analytics,
- continue using existing OGCode, custom tests, DPP, study rooms, Origin AI, and dashboard features.

## Onboarding and Login

### Teacher-Side Entry

The teacher-side login/signup page first asks:

- Personal use
- Institute/coaching use

This choice creates or selects a workspace type. It should not create separate auth systems.

### Personal Teacher Signup

Fields:

- name,
- email,
- password or OTP/social auth,
- subjects,
- years of experience,
- expected student capacity,
- optional display name,
- optional public profile data.

System action:

- create `origin_users` row with role `teacher`,
- create `app.teacher_workspaces` row with `workspace_type = 'personal'`,
- create `app.workspace_members` owner membership,
- generate a default student join code that can be rotated.

### Institute Signup

Fields:

- owner name,
- owner email,
- password or OTP/social auth,
- institute display name,
- legal name optional,
- city/state optional,
- subjects/courses offered,
- organization code chosen by user,
- expected student capacity.

Organization code behavior:

- show live availability while typing,
- normalize to a safe uppercase code, for example `ORIGIN-JEE-A1` or `AKASH-PHY-12`,
- block reserved words and offensive patterns,
- enforce unique active code,
- allow later rotation/generation of new student join code if the old code leaks.

System action:

- create owner user with role `teacher`,
- create `app.teacher_workspaces` row with `workspace_type = 'institute'`,
- create owner membership,
- create active organization/student join code,
- mark workspace verification as `unverified` until platform admin verifies it if public marketplace listing is requested.

## Student Enrollment

### Code-Based Enrollment

Flow:

1. Student enters organization code.
2. Next.js resolves the active code.
3. System creates `app.workspace_student_enrollments`.
4. Enrollment status starts as `unassigned` unless the code is batch-specific.
5. Student appears in the teacher/institute "Unassigned students" section.
6. Teacher assigns the student to one or more batches.
7. Student gets access to assigned batch content, rooms, tests, and materials.

Important rule:

- Enrollment into a workspace is separate from membership in a batch.
- A student can be enrolled in a workspace but not yet assigned to any batch.

### Future Paid Direct Enrollment

Later flow:

1. Student opens marketplace of institutes in collaboration with ORIGIN.
2. Student pays inside ORIGIN.
3. Payment creates a `commerce.enrollment_order`.
4. Successful payment creates workspace enrollment.
5. Student lands in unassigned queue or an auto-selected batch if the purchased package maps to a batch.

The schema should reserve this now, but implementation can be Phase 12.

## Teacher Workspace Modules

### Home

Teacher/institute home should show:

- unassigned student count,
- active batches,
- tests scheduled today,
- recent submissions,
- weak topic alerts,
- import jobs needing review,
- OGCode drafts needing solution/hints,
- service degraded warnings if analytics/import is unavailable.

### Students

Sections:

- Unassigned students,
- Active by batch,
- Suspended/removed,
- Invite/enroll history,
- Search/filter by name, email, batch, subject, enrollment source.

Actions:

- assign to batch,
- assign to multiple batches,
- remove from batch,
- suspend from workspace,
- export CSV,
- view student analytics,
- manually enroll by email/phone later.

### Batches

Batch data:

- name,
- course/exam,
- subject or mixed,
- class level,
- schedule,
- teachers assigned,
- capacity,
- start/end dates,
- status.

Batch actions:

- create/edit/archive batch,
- assign students,
- assign staff,
- attach materials,
- assign tests,
- create room for the batch,
- view analytics,
- view leaderboard history.

### Question Bag

Question Bag is the workspace-private question bank.

Teachers/institutes can:

- add question manually,
- import questions from PDF/DOCX/images,
- attach reference image/diagram/table,
- edit drafts,
- version questions,
- tag by subject/chapter/concept/topic,
- set difficulty,
- create answer spec,
- use questions in tests/rooms,
- optionally publish a question to OGCode after meeting public quality requirements.

Manual question fields:

- question stem,
- question type: MCQ, MSQ, numerical, numerical with units, symbolic, equation, matrix match, subjective,
- options or expected answer,
- correct option(s),
- answer spec,
- subject,
- chapter,
- concept/topic,
- difficulty,
- tags,
- reference diagram/image/table/document link,
- hint optional for private bag,
- full solution optional for private bag,
- explanation optional for private bag,
- internal notes optional.

### Study Materials

Study Materials supports:

- PDF,
- DOC/DOCX,
- image,
- future video links/assets,
- batch assignment,
- visibility controls,
- title/description/subject/chapter/tags,
- versioning,
- archive/delete controls,
- download/view tracking.

### Rooms

Teacher rooms should reuse the student-side study room model, but become teacher-controlled:

- teacher creates a room,
- room can be scoped to workspace or batch,
- teacher shares room code,
- students join,
- teacher configures test source:
  - selected Question Bag questions,
  - selected OGCode questions,
  - mixed selected Question Bag plus OGCode,
  - random from Question Bag,
  - random from OGCode using current analytics-service style,
  - generated from weak topics.
- teacher sets timer,
- teacher starts test,
- students submit,
- existing grader-service and analytics-service process results,
- room leaderboard persists for teacher review.

### Scheduled Tests

Teachers/institutes can pre-build tests:

- draft test,
- schedule date/time,
- assign to one or more batches or selected students,
- set timer/duration,
- choose question source,
- lock edits after publish unless versioned,
- auto-open/close by server time,
- support retake policy later.

### Student Analytics

Teacher analytics should include:

- batch-level radar chart by topic/concept,
- hot topics where many students fail,
- weak topics by severity,
- strong topics,
- previous test leaderboards,
- most improved students,
- weakest students by topic and consistency,
- individual student strengths and weak topics,
- DPP completion and progress where relevant.

Data source:

- analytics-service computes topic signals.
- Postgres stores per-attempt, per-student, per-batch, and per-assessment snapshots.
- Teacher UI reads snapshots, not raw analytics calculations.

### OGCode Publishing

Teachers/institutes can publish questions to OGCode, but public publishing is stricter than private Question Bag.

Mandatory before OGCode publish:

- hint,
- fully solved solution,
- correct answer/answer spec,
- subject/chapter/concept/difficulty,
- any reference image/table required to understand the question,
- attribution display name and optional logo.

Reason:

- Origin AI can answer OGCode doubts using stored full solutions first, lowering generation tokens and improving consistency.

Publishing lifecycle:

- private draft,
- submit for OGCode review,
- platform moderation,
- published,
- edit creates new version,
- republish new version,
- old version remains in audit history and can be hidden/archived.

## Admin-Side Scope

Admin must control the whole system:

- all students,
- all teachers,
- all institutes,
- staff roles,
- org codes,
- batch visibility,
- Question Bag abuse reports,
- OGCode published questions,
- import jobs,
- analytics,
- service status,
- payments later,
- marketplace listings later,
- audit log.

Admin should be able to:

- impersonate/support a workspace safely,
- suspend workspace,
- revoke leaked organization code,
- approve or reject institute marketplace listing,
- approve/reject OGCode submissions,
- edit global taxonomy,
- view service latency/errors,
- inspect failed imports,
- roll back bad public question versions.

## Product States

### Workspace State

- `active`
- `trial`
- `suspended`
- `closed`

### Enrollment State

- `unassigned`
- `active`
- `suspended`
- `left`

### Batch State

- `draft`
- `active`
- `completed`
- `archived`

### Question State

- `draft`
- `needs_review`
- `ready`
- `published_private`
- `submitted_to_ogcode`
- `published_ogcode`
- `rejected`
- `archived`

### Import Job State

- `queued`
- `processing`
- `needs_review`
- `succeeded`
- `failed`

### Test State

- `draft`
- `scheduled`
- `published`
- `live`
- `closed`
- `archived`
