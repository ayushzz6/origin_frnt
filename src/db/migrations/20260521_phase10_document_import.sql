-- Phase 10: Document Import Service
-- Migration ID: 20260521_phase10_document_import
-- Creates the `import` schema and tables for document import jobs, pages, and questions.

BEGIN;

CREATE SCHEMA IF NOT EXISTS import;

DO $$ BEGIN
  CREATE TYPE import.import_source_type AS ENUM ('pdf', 'docx', 'txt', 'image', 'url');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE import.import_job_status AS ENUM ('queued', 'processing', 'review_required', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE import.import_page_status AS ENUM ('pending', 'parsed', 'review_required', 'accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE import.import_question_status AS ENUM ('draft', 'review_required', 'accepted', 'rejected', 'published');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS import.document_import_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  source_type import.import_source_type NOT NULL,
  source_file_name TEXT NOT NULL,
  source_r2_object_key TEXT NOT NULL,
  source_r2_bucket TEXT NOT NULL,
  source_mime_type TEXT NOT NULL,
  source_size_bytes BIGINT NOT NULL DEFAULT 0,
  source_sha256 TEXT NOT NULL,
  subject TEXT,
  chapter TEXT,
  status import.import_job_status NOT NULL DEFAULT 'queued',
  total_pages INTEGER,
  processed_pages INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER,
  accepted_questions INTEGER NOT NULL DEFAULT 0,
  review_required_questions INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT NOT NULL REFERENCES origin_users(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_workspace
  ON import.document_import_jobs(workspace_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS import.import_job_pages (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES import.document_import_jobs(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  status import.import_page_status NOT NULL DEFAULT 'pending',
  extracted_text TEXT,
  extracted_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  review_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_import_pages_job_status
  ON import.import_job_pages(job_id, status, page_number);

CREATE TABLE IF NOT EXISTS import.import_job_questions (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES import.document_import_jobs(id) ON DELETE CASCADE,
  page_id TEXT REFERENCES import.import_job_pages(id),
  question_number INTEGER,
  question_type TEXT,
  subject TEXT,
  chapter TEXT,
  concept TEXT,
  question_text TEXT,
  options JSONB,
  correct_option INTEGER,
  correct_options JSONB,
  answer_text TEXT,
  explanation TEXT,
  hint TEXT,
  has_diagram BOOLEAN NOT NULL DEFAULT false,
  diagram_description TEXT,
  status import.import_question_status NOT NULL DEFAULT 'draft',
  confidence_score NUMERIC(5,4),
  review_notes TEXT,
  rejection_reason TEXT,
  question_bag_question_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_questions_job_status
  ON import.import_job_questions(job_id, status, question_number);

-- Phase 12: Paid Enrollment & Marketplace tables (app schema)
CREATE TABLE IF NOT EXISTS app.workspace_offerings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  price_amount NUMERIC(10,2) NOT NULL,
  price_currency TEXT NOT NULL DEFAULT 'INR',
  duration_months INTEGER,
  batch_ids TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT,
  class_level TEXT,
  max_enrollments INTEGER,
  current_enrollments INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_offerings_workspace_status
  ON app.workspace_offerings(workspace_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS app.enrollment_orders (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  offering_id TEXT NOT NULL REFERENCES app.workspace_offerings(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_provider TEXT NOT NULL,
  payment_intent_id TEXT,
  payment_provider_order_id TEXT,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  enrolled_batch_id TEXT REFERENCES app.batches(id),
  enrolled_at TIMESTAMPTZ,
  payment_completed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrollment_orders_workspace
  ON app.enrollment_orders(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollment_orders_student
  ON app.enrollment_orders(student_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollment_orders_offering
  ON app.enrollment_orders(offering_id, status);

INSERT INTO app.migrations (id, name) VALUES ('20260521_phase10_document_import', 'phase 10 document import + phase 12 marketplace') ON CONFLICT (id) DO NOTHING;

COMMIT;
