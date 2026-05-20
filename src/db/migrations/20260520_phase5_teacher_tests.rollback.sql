-- Rollback for 20260520_phase5_teacher_tests.sql

DROP TABLE IF EXISTS assessment.test_answers;
DROP TABLE IF EXISTS assessment.test_attempts;
DROP TABLE IF EXISTS assessment.test_assignments;
DROP TABLE IF EXISTS assessment.test_questions;
DROP TABLE IF EXISTS assessment.tests;

DROP TYPE IF EXISTS assessment.analytics_status;
DROP TYPE IF EXISTS assessment.grading_status;
DROP TYPE IF EXISTS assessment.attempt_status;
DROP TYPE IF EXISTS assessment.assignment_status;
DROP TYPE IF EXISTS assessment.question_source_bank;
DROP TYPE IF EXISTS assessment.test_source;
DROP TYPE IF EXISTS assessment.test_status;
DROP TYPE IF EXISTS assessment.test_owner_scope;

DELETE FROM app.migrations WHERE id = '20260520_phase5_teacher_tests';
