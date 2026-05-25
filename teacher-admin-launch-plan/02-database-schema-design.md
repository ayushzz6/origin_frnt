# Database Schema Design

## Design Goals

- Support personal teachers and institutes through one workspace model.
- Keep student-side beta data compatible during rollout.
- Avoid duplicating OGCode, tests, rooms, analytics, and grading logic.
- Support future paid enrollment and institute marketplace without a future rewrite.
- Version question content so edits after publishing remain auditable.
- Store large files in R2 and metadata in Postgres.
- Keep hot query paths indexed by workspace, batch, user, status, and created time.
- Use JSONB for flexible metadata only, not for core relationships.

## Current Compatibility Notes

Current V1 already has:

- `origin_users` in public schema for auth users with `role in ('student','teacher','admin')`.
- `ogcode_questions` as the current platform question bank table.
- `analytics.*` for custom tests, test results, topic analytics, DPP plans, DPP attempts.
- `rooms.*` for student study rooms and room leaderboards.
- `origin_ai.*` for Origin AI sessions, messages, memory, and embeddings.

The plan below can be implemented additively. Existing student flows should continue using the current tables while adapters gradually route teacher/admin flows into the normalized schema.

## Schema Overview

Recommended schemas:

- `app`: identity-adjacent product tables, workspaces, enrollments, batches, audit.
- `content`: Question Bag, question versions, assets, study materials, OGCode publication workflow.
- `assessment`: durable teacher/admin tests, scheduled tests, assignments, attempts.
- `analytics`: existing analytics tables plus workspace/batch aggregate snapshots.
- `rooms`: existing room tables with additive workspace/batch fields.
- `import`: long-running document import jobs and review state.
- `commerce`: future paid direct enrollment.

## Workspace and Staff

### `app.teacher_workspaces`

One row for each personal teacher workspace or institute.

```sql
CREATE TYPE app.teacher_workspace_type AS ENUM ('personal', 'institute');
CREATE TYPE app.workspace_status AS ENUM ('active', 'trial', 'suspended', 'closed');
CREATE TYPE app.workspace_verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');

CREATE TABLE app.teacher_workspaces (
  id TEXT PRIMARY KEY,
  workspace_type app.teacher_workspace_type NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES origin_users(id),
  display_name TEXT NOT NULL,
  legal_name TEXT,
  slug TEXT UNIQUE,
  logo_asset_id TEXT,
  city TEXT,
  state TEXT,
  country TEXT NOT NULL DEFAULT 'IN',
  subjects TEXT[] NOT NULL DEFAULT '{}',
  courses TEXT[] NOT NULL DEFAULT '{}',
  status app.workspace_status NOT NULL DEFAULT 'active',
  verification_status app.workspace_verification_status NOT NULL DEFAULT 'unverified',
  public_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teacher_workspaces_owner ON app.teacher_workspaces(owner_user_id);
CREATE INDEX idx_teacher_workspaces_type_status ON app.teacher_workspaces(workspace_type, status);
CREATE INDEX idx_teacher_workspaces_verified ON app.teacher_workspaces(verification_status, status);
```

### `app.workspace_members`

Staff credentials for institute and future personal-teacher assistants.

```sql
CREATE TYPE app.workspace_member_role AS ENUM (
  'owner',
  'admin',
  'teacher',
  'content_manager',
  'analyst',
  'support'
);
CREATE TYPE app.workspace_member_status AS ENUM ('invited', 'active', 'disabled', 'removed');

CREATE TABLE app.workspace_members (
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  role app.workspace_member_role NOT NULL,
  status app.workspace_member_status NOT NULL DEFAULT 'active',
  invited_by TEXT REFERENCES origin_users(id),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_user ON app.workspace_members(user_id, status);
CREATE INDEX idx_workspace_members_workspace_role ON app.workspace_members(workspace_id, role, status);
```

### `app.workspace_codes`

Organization/student join codes and staff invite codes.

```sql
CREATE TYPE app.workspace_code_type AS ENUM ('student_join', 'staff_invite', 'batch_join');
CREATE TYPE app.workspace_code_status AS ENUM ('reserved', 'active', 'revoked', 'expired');

CREATE TABLE app.workspace_codes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  batch_id TEXT,
  normalized_code TEXT NOT NULL,
  display_code TEXT NOT NULL,
  code_type app.workspace_code_type NOT NULL,
  status app.workspace_code_status NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL REFERENCES origin_users(id),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_active_workspace_code
  ON app.workspace_codes(normalized_code)
  WHERE status IN ('reserved', 'active');

CREATE INDEX idx_workspace_codes_workspace_active
  ON app.workspace_codes(workspace_id, code_type, status, created_at DESC);
```

Code availability should query the partial unique index and a reserved-word list before returning available.

## Student Enrollment and Batches

### `app.workspace_student_enrollments`

Workspace enrollment is separate from batch assignment.

```sql
CREATE TYPE app.enrollment_source AS ENUM ('code', 'manual', 'admin_import', 'paid_app', 'migration');
CREATE TYPE app.enrollment_status AS ENUM ('unassigned', 'active', 'suspended', 'left');

CREATE TABLE app.workspace_student_enrollments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  source app.enrollment_source NOT NULL,
  join_code_id TEXT REFERENCES app.workspace_codes(id),
  status app.enrollment_status NOT NULL DEFAULT 'unassigned',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (workspace_id, student_id)
);

CREATE INDEX idx_workspace_enrollments_workspace_status
  ON app.workspace_student_enrollments(workspace_id, status, enrolled_at DESC);
CREATE INDEX idx_workspace_enrollments_student
  ON app.workspace_student_enrollments(student_id, status);
```

### `app.batches`

```sql
CREATE TYPE app.batch_status AS ENUM ('draft', 'active', 'completed', 'archived');

CREATE TABLE app.batches (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  course TEXT,
  subject TEXT,
  class_level TEXT,
  schedule_text TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  capacity INTEGER,
  status app.batch_status NOT NULL DEFAULT 'active',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL REFERENCES origin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batches_workspace_status ON app.batches(workspace_id, status, created_at DESC);
CREATE INDEX idx_batches_subject ON app.batches(workspace_id, subject, status);
```

### `app.batch_members`

A student can be in multiple batches.

```sql
CREATE TYPE app.batch_member_status AS ENUM ('active', 'removed', 'completed');

CREATE TABLE app.batch_members (
  batch_id TEXT NOT NULL REFERENCES app.batches(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  status app.batch_member_status NOT NULL DEFAULT 'active',
  assigned_by TEXT REFERENCES origin_users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (batch_id, student_id)
);

CREATE INDEX idx_batch_members_workspace_student
  ON app.batch_members(workspace_id, student_id, status);
CREATE INDEX idx_batch_members_batch_status
  ON app.batch_members(batch_id, status, assigned_at DESC);
```

### `app.batch_staff`

```sql
CREATE TABLE app.batch_staff (
  batch_id TEXT NOT NULL REFERENCES app.batches(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  role app.workspace_member_role NOT NULL DEFAULT 'teacher',
  assigned_by TEXT REFERENCES origin_users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (batch_id, user_id)
);

CREATE INDEX idx_batch_staff_user ON app.batch_staff(user_id, workspace_id);
```

## Content, Question Bag, Assets, and OGCode

### `content.assets`

All uploaded files, including question reference images, study materials, imported documents, logos, and diagrams. Bytes live in R2; Postgres stores metadata.

```sql
CREATE TYPE content.asset_owner_type AS ENUM ('workspace', 'platform', 'user');
CREATE TYPE content.asset_kind AS ENUM ('image', 'pdf', 'doc', 'docx', 'video', 'audio', 'other');

CREATE TABLE content.assets (
  id TEXT PRIMARY KEY,
  owner_type content.asset_owner_type NOT NULL,
  owner_workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  owner_user_id TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  kind content.asset_kind NOT NULL,
  mime_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  sha256 TEXT NOT NULL,
  r2_bucket TEXT NOT NULL,
  r2_object_key TEXT NOT NULL,
  public_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT REFERENCES origin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_assets_bucket_key ON content.assets(r2_bucket, r2_object_key);
CREATE INDEX idx_assets_workspace_kind ON content.assets(owner_workspace_id, kind, created_at DESC);
CREATE INDEX idx_assets_sha256 ON content.assets(sha256);
```

### `content.questions`

Canonical question identity. Question body lives in versions.

```sql
CREATE TYPE content.question_owner_scope AS ENUM ('platform', 'workspace');
CREATE TYPE content.question_visibility AS ENUM ('private', 'workspace', 'public_ogcode');
CREATE TYPE content.question_status AS ENUM (
  'draft',
  'needs_review',
  'ready',
  'published_private',
  'submitted_to_ogcode',
  'published_ogcode',
  'rejected',
  'archived'
);

CREATE TABLE content.questions (
  id TEXT PRIMARY KEY,
  owner_scope content.question_owner_scope NOT NULL,
  workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES origin_users(id),
  current_version_id TEXT,
  visibility content.question_visibility NOT NULL DEFAULT 'private',
  status content.question_status NOT NULL DEFAULT 'draft',
  source_kind TEXT NOT NULL DEFAULT 'manual',
  imported_job_id TEXT,
  external_source_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (owner_scope = 'platform' AND workspace_id IS NULL)
    OR (owner_scope = 'workspace' AND workspace_id IS NOT NULL)
  )
);

CREATE INDEX idx_questions_workspace_status
  ON content.questions(workspace_id, status, updated_at DESC);
CREATE INDEX idx_questions_visibility_status
  ON content.questions(visibility, status, updated_at DESC);
```

### `content.question_versions`

Every edit creates a new version.

```sql
CREATE TYPE content.question_type AS ENUM (
  'mcq',
  'msq',
  'numerical',
  'numerical_with_units',
  'symbolic_expression',
  'equation',
  'matrix_match',
  'subjective'
);

CREATE TABLE content.question_versions (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES content.questions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  question_type content.question_type NOT NULL,
  stem TEXT NOT NULL,
  options JSONB,
  correct_option INTEGER,
  correct_options JSONB,
  answer_text TEXT,
  answer_spec JSONB,
  matrix_data JSONB,
  hint TEXT,
  explanation TEXT,
  full_solution TEXT,
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  concept TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'insane')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  import_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL REFERENCES origin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_id, version_number)
);

CREATE INDEX idx_question_versions_subject_chapter
  ON content.question_versions(subject, chapter, concept);
CREATE INDEX idx_question_versions_question
  ON content.question_versions(question_id, version_number DESC);
```

### `content.question_asset_links`

```sql
CREATE TYPE content.question_asset_purpose AS ENUM (
  'reference_image',
  'reference_diagram',
  'reference_table',
  'solution_image',
  'source_page_snapshot'
);

CREATE TABLE content.question_asset_links (
  question_version_id TEXT NOT NULL REFERENCES content.question_versions(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES content.assets(id) ON DELETE CASCADE,
  purpose content.question_asset_purpose NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (question_version_id, asset_id, purpose)
);

CREATE INDEX idx_question_asset_links_asset ON content.question_asset_links(asset_id);
```

### `content.ogcode_publications`

Public OGCode contribution lifecycle.

```sql
CREATE TYPE content.ogcode_publication_status AS ENUM (
  'draft',
  'submitted',
  'approved',
  'published',
  'changes_requested',
  'rejected',
  'archived'
);

CREATE TABLE content.ogcode_publications (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES content.questions(id) ON DELETE CASCADE,
  question_version_id TEXT NOT NULL REFERENCES content.question_versions(id),
  contributor_workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE SET NULL,
  contributor_user_id TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  attribution_name TEXT NOT NULL,
  attribution_logo_asset_id TEXT REFERENCES content.assets(id),
  status content.ogcode_publication_status NOT NULL DEFAULT 'draft',
  moderation_notes TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_by TEXT REFERENCES origin_users(id),
  reviewed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ogcode_publications_status
  ON content.ogcode_publications(status, submitted_at DESC);
CREATE INDEX idx_ogcode_publications_workspace
  ON content.ogcode_publications(contributor_workspace_id, status);
```

Compatibility path:

- Keep `ogcode_questions` for current student-side reads.
- Add a sync/view layer that publishes approved `content.question_versions` into `ogcode_questions` or creates an `ogcode_questions_v2` view.
- Origin AI should prefer `full_solution` from the current published version when answering OGCode question doubts.

## Study Materials

```sql
CREATE TYPE content.study_material_status AS ENUM ('draft', 'published', 'archived');

CREATE TABLE content.study_materials (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  chapter TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status content.study_material_status NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL REFERENCES origin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE content.study_material_assets (
  material_id TEXT NOT NULL REFERENCES content.study_materials(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES content.assets(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (material_id, asset_id)
);

CREATE TABLE content.study_material_assignments (
  material_id TEXT NOT NULL REFERENCES content.study_materials(id) ON DELETE CASCADE,
  batch_id TEXT REFERENCES app.batches(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES origin_users(id) ON DELETE CASCADE,
  assigned_by TEXT REFERENCES origin_users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (batch_id IS NOT NULL OR student_id IS NOT NULL)
);

CREATE INDEX idx_study_materials_workspace_status
  ON content.study_materials(workspace_id, status, updated_at DESC);
CREATE INDEX idx_study_material_assignments_batch
  ON content.study_material_assignments(batch_id, assigned_at DESC);
```

## Assessments and Scheduled Tests

### `assessment.tests`

Teacher/admin tests should not be forced into `analytics.custom_tests` long term. Use a durable test table and allow an adapter to create `analytics.custom_tests` records during migration.

```sql
CREATE TYPE assessment.test_owner_scope AS ENUM ('student', 'workspace', 'platform');
CREATE TYPE assessment.test_status AS ENUM ('draft', 'scheduled', 'published', 'live', 'closed', 'archived');
CREATE TYPE assessment.test_source AS ENUM ('manual', 'random', 'imported', 'room', 'analytics_generated');

CREATE TABLE assessment.tests (
  id TEXT PRIMARY KEY,
  owner_scope assessment.test_owner_scope NOT NULL,
  workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES origin_users(id),
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL DEFAULT 'mixed',
  chapter TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  duration_minutes INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  status assessment.test_status NOT NULL DEFAULT 'draft',
  source assessment.test_source NOT NULL DEFAULT 'manual',
  selection_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  scoring_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_import_job_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assessment_tests_workspace_status
  ON assessment.tests(workspace_id, status, created_at DESC);
CREATE INDEX idx_assessment_tests_created_by
  ON assessment.tests(created_by, created_at DESC);
```

### `assessment.test_questions`

Supports OGCode and workspace Question Bag questions in the same test.

```sql
CREATE TYPE assessment.question_source_bank AS ENUM ('ogcode', 'workspace_bag', 'platform_content');

CREATE TABLE assessment.test_questions (
  test_id TEXT NOT NULL REFERENCES assessment.tests(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  source_bank assessment.question_source_bank NOT NULL,
  ogcode_question_id TEXT,
  content_question_id TEXT REFERENCES content.questions(id),
  content_question_version_id TEXT REFERENCES content.question_versions(id),
  marks DOUBLE PRECISION NOT NULL DEFAULT 4,
  negative_marks DOUBLE PRECISION NOT NULL DEFAULT -1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (test_id, position),
  CHECK (
    (source_bank = 'ogcode' AND ogcode_question_id IS NOT NULL)
    OR (source_bank <> 'ogcode' AND content_question_id IS NOT NULL AND content_question_version_id IS NOT NULL)
  )
);

CREATE INDEX idx_test_questions_content_question ON assessment.test_questions(content_question_id);
CREATE INDEX idx_test_questions_ogcode_question ON assessment.test_questions(ogcode_question_id);
```

### `assessment.test_assignments`

```sql
CREATE TYPE assessment.assignment_status AS ENUM ('assigned', 'open', 'closed', 'cancelled');

CREATE TABLE assessment.test_assignments (
  id TEXT PRIMARY KEY,
  test_id TEXT NOT NULL REFERENCES assessment.tests(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  batch_id TEXT REFERENCES app.batches(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES origin_users(id) ON DELETE CASCADE,
  scheduled_start_at TIMESTAMPTZ,
  scheduled_end_at TIMESTAMPTZ,
  status assessment.assignment_status NOT NULL DEFAULT 'assigned',
  assigned_by TEXT REFERENCES origin_users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  CHECK (batch_id IS NOT NULL OR student_id IS NOT NULL)
);

CREATE INDEX idx_test_assignments_batch_status
  ON assessment.test_assignments(batch_id, status, scheduled_start_at);
CREATE INDEX idx_test_assignments_student_status
  ON assessment.test_assignments(student_id, status, scheduled_start_at);
```

### `assessment.test_attempts` and `assessment.test_answers`

These can later replace or feed current `analytics.test_results`.

```sql
CREATE TYPE assessment.attempt_status AS ENUM ('in_progress', 'submitted', 'timed_out', 'force_submitted', 'needs_review');

CREATE TABLE assessment.test_attempts (
  id TEXT PRIMARY KEY,
  test_id TEXT NOT NULL REFERENCES assessment.tests(id) ON DELETE CASCADE,
  assignment_id TEXT REFERENCES assessment.test_assignments(id) ON DELETE SET NULL,
  workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE SET NULL,
  batch_id TEXT REFERENCES app.batches(id) ON DELETE SET NULL,
  room_id TEXT,
  student_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status assessment.attempt_status NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  server_deadline TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  score DOUBLE PRECISION,
  total_marks DOUBLE PRECISION NOT NULL DEFAULT 0,
  percentage DOUBLE PRECISION,
  time_taken_seconds INTEGER,
  grading_status TEXT NOT NULL DEFAULT 'pending',
  analytics_status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (test_id, student_id, attempt_number)
);

CREATE INDEX idx_attempts_student_status ON assessment.test_attempts(student_id, status, started_at DESC);
CREATE INDEX idx_attempts_batch_submitted ON assessment.test_attempts(batch_id, submitted_at DESC);
CREATE INDEX idx_attempts_workspace_test ON assessment.test_attempts(workspace_id, test_id, submitted_at DESC);

CREATE TABLE assessment.test_answers (
  attempt_id TEXT NOT NULL REFERENCES assessment.test_attempts(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  question_snapshot JSONB NOT NULL,
  submitted_answer JSONB NOT NULL DEFAULT '{}'::jsonb,
  grading_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  is_marked_for_review BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (attempt_id, position)
);
```

## Rooms Extension

Current `rooms.rooms` can be extended:

```sql
ALTER TABLE rooms.rooms
  ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_id TEXT REFERENCES app.batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS teacher_test_id TEXT REFERENCES assessment.tests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS room_kind TEXT NOT NULL DEFAULT 'student_room';

CREATE INDEX IF NOT EXISTS idx_rooms_workspace_status
  ON rooms.rooms(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_batch_status
  ON rooms.rooms(batch_id, status, created_at DESC);
```

This keeps the current room implementation usable while teacher rooms get workspace and batch scoping.

## Analytics Extensions

Existing `analytics.test_results` should be extended for workspace/batch context, or new snapshots should link to `assessment.test_attempts`.

```sql
ALTER TABLE analytics.test_results
  ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_id TEXT REFERENCES app.batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assessment_test_id TEXT,
  ADD COLUMN IF NOT EXISTS source_context TEXT NOT NULL DEFAULT 'student_custom';

CREATE INDEX IF NOT EXISTS idx_analytics_results_workspace_batch
  ON analytics.test_results(workspace_id, batch_id, created_at DESC);
```

### `analytics.batch_topic_snapshots`

```sql
CREATE TABLE analytics.batch_topic_snapshots (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  batch_id TEXT NOT NULL REFERENCES app.batches(id) ON DELETE CASCADE,
  test_id TEXT,
  topic TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT,
  concept TEXT,
  attempts INTEGER NOT NULL,
  accuracy DOUBLE PRECISION NOT NULL,
  bkt_mastery DOUBLE PRECISION NOT NULL,
  expected_correctness DOUBLE PRECISION NOT NULL,
  severity TEXT NOT NULL,
  weak_student_count INTEGER NOT NULL DEFAULT 0,
  strong_student_count INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batch_topic_snapshots_batch_computed
  ON analytics.batch_topic_snapshots(batch_id, computed_at DESC);
CREATE INDEX idx_batch_topic_snapshots_hot_topics
  ON analytics.batch_topic_snapshots(workspace_id, severity, accuracy, computed_at DESC);
```

### `analytics.student_topic_profiles`

```sql
CREATE TABLE analytics.student_topic_profiles (
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  chapter TEXT,
  concept TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  accuracy DOUBLE PRECISION NOT NULL DEFAULT 0,
  bkt_mastery DOUBLE PRECISION NOT NULL DEFAULT 0,
  expected_correctness DOUBLE PRECISION NOT NULL DEFAULT 0,
  severity TEXT NOT NULL DEFAULT 'medium',
  last_attempt_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, student_id, subject, concept)
);

CREATE INDEX idx_student_topic_profiles_workspace_student
  ON analytics.student_topic_profiles(workspace_id, student_id, severity);
```

### `analytics.leaderboard_snapshots`

```sql
CREATE TABLE analytics.leaderboard_snapshots (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  batch_id TEXT REFERENCES app.batches(id) ON DELETE CASCADE,
  test_id TEXT NOT NULL,
  rows JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leaderboard_snapshots_batch_test
  ON analytics.leaderboard_snapshots(batch_id, test_id, created_at DESC);
```

## Document Import Jobs

Use a dedicated schema so import can become a separate microservice without touching core content tables.

```sql
CREATE TYPE import.job_status AS ENUM ('queued', 'processing', 'needs_review', 'succeeded', 'failed', 'cancelled');
CREATE TYPE import.job_stage AS ENUM (
  'queued',
  'upload_saved',
  'classified',
  'text_extracted',
  'layout_extracted',
  'reconciled',
  'verified',
  'reviewing',
  'persisted',
  'failed'
);

CREATE TABLE import.document_import_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL REFERENCES origin_users(id),
  target_surface TEXT NOT NULL CHECK (target_surface IN ('question_bag', 'ogcode_draft', 'admin_ogcode')),
  source_asset_id TEXT NOT NULL REFERENCES content.assets(id),
  status import.job_status NOT NULL DEFAULT 'queued',
  stage import.job_stage NOT NULL DEFAULT 'queued',
  requested_question_count INTEGER,
  classification JSONB NOT NULL DEFAULT '{}'::jsonb,
  diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  cost JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_import_jobs_workspace_status
  ON import.document_import_jobs(workspace_id, status, created_at DESC);
CREATE INDEX idx_import_jobs_status_stage
  ON import.document_import_jobs(status, stage, created_at);
```

Draft questions from import can directly create `content.questions` in `needs_review` state with `imported_job_id`, or use a staging table first if review UX needs non-question fragments.

## Future Commerce

Reserve for direct paid enrollment.

```sql
CREATE TYPE commerce.order_status AS ENUM ('created', 'payment_pending', 'paid', 'failed', 'refunded', 'cancelled');

CREATE TABLE commerce.workspace_offerings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  target_batch_id TEXT REFERENCES app.batches(id),
  status TEXT NOT NULL DEFAULT 'draft',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE commerce.enrollment_orders (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL REFERENCES commerce.workspace_offerings(id),
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id),
  student_id TEXT NOT NULL REFERENCES origin_users(id),
  status commerce.order_status NOT NULL DEFAULT 'created',
  provider TEXT,
  provider_payment_id TEXT,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  enrollment_id TEXT REFERENCES app.workspace_student_enrollments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Audit and Moderation

```sql
CREATE TABLE app.audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before JSONB,
  after JSONB,
  request_id TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_events_workspace_time
  ON app.audit_events(workspace_id, created_at DESC);
CREATE INDEX idx_audit_events_entity
  ON app.audit_events(entity_type, entity_id, created_at DESC);
```

## Query Optimization Notes

- Most teacher screens query by `(workspace_id, status, created_at DESC)`.
- Batch screens query by `(batch_id, status)` and `(workspace_id, student_id)`.
- Analytics radar screens should read aggregate snapshots, not compute from raw attempts on request.
- Use `content.questions.current_version_id` for hot reads, but preserve version history.
- Use partial unique index for active organization codes.
- Use `sha256` on assets to detect duplicate uploads and support future deduplication.
- For text search, add `tsvector` columns later on question stem, solution, tags, materials title, and institute name.
- For semantic search, use pgvector embeddings for question versions and study material chunks later.

