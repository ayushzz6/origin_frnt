-- Rollback for 20260520_phase3_enrollment_batches.sql

DROP TABLE IF EXISTS app.batch_staff;
DROP TABLE IF EXISTS app.batch_members;
DROP TABLE IF EXISTS app.batches;
DROP TABLE IF EXISTS app.workspace_student_enrollments;

DROP TYPE IF EXISTS app.batch_member_status;
DROP TYPE IF EXISTS app.batch_status;
DROP TYPE IF EXISTS app.enrollment_status;
DROP TYPE IF EXISTS app.enrollment_source;

DELETE FROM app.migrations WHERE id = '20260520_phase3_enrollment_batches';
