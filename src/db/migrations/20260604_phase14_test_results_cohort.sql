-- Phase 14 (section B.5): cohort context on analytics.test_results so teacher-
-- assigned submissions carry workspace/batch/assignment and Phase-8 / 2E cohort
-- analytics population is idempotent per attempt. analytics.* lives in the OGCODE
-- pool which, in this deployment, is the same physical Neon DB as app.* /
-- assessment.*, so these columns mirror the assignment without a cross-pool FK.
-- Mirrored by the ANALYTICS_SCHEMA_SQL runtime-ensure in src/legacy/analytics-store.ts.
-- See PREMIUM_AND_TEACHER_CONNECTION_PLAN.md (Phase 2, section E + B.5).

ALTER TABLE analytics.test_results ADD COLUMN IF NOT EXISTS workspace_id TEXT;
ALTER TABLE analytics.test_results ADD COLUMN IF NOT EXISTS batch_id TEXT;
ALTER TABLE analytics.test_results ADD COLUMN IF NOT EXISTS assignment_id TEXT;

CREATE INDEX IF NOT EXISTS idx_test_results_cohort
  ON analytics.test_results (workspace_id, batch_id, created_at DESC);

INSERT INTO app.migrations (id, name)
VALUES ('20260604_phase14_test_results_cohort', 'phase 14 test_results cohort columns')
ON CONFLICT (id) DO NOTHING;
