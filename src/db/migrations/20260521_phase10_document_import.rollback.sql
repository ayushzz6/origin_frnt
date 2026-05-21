-- Phase 10: Document Import Service Rollback
-- Migration ID: 20260521_phase10_document_import

BEGIN;

DROP TABLE IF EXISTS import.import_job_questions CASCADE;
DROP TABLE IF EXISTS import.import_job_pages CASCADE;
DROP TABLE IF EXISTS import.document_import_jobs CASCADE;
DROP TABLE IF EXISTS app.enrollment_orders CASCADE;
DROP TABLE IF EXISTS app.workspace_offerings CASCADE;

DROP TYPE IF EXISTS import.import_question_status;
DROP TYPE IF EXISTS import.import_page_status;
DROP TYPE IF EXISTS import.import_job_status;
DROP TYPE IF EXISTS import.import_source_type;

DELETE FROM app.migrations WHERE id = '20260521_phase10_document_import';

COMMIT;
