-- Rollback for 20260604_phase14_test_results_cohort.sql
DROP INDEX IF EXISTS analytics.idx_test_results_cohort;
ALTER TABLE analytics.test_results DROP COLUMN IF EXISTS assignment_id;
ALTER TABLE analytics.test_results DROP COLUMN IF EXISTS batch_id;
ALTER TABLE analytics.test_results DROP COLUMN IF EXISTS workspace_id;
DELETE FROM app.migrations WHERE id = '20260604_phase14_test_results_cohort';
