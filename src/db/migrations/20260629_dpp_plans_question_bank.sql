-- Question-Bag-aware DPPs: stamp the owning workspace (gates tenant-isolated
-- visibility — a bag-sourced DPP is only shown to students still enrolled in
-- that workspace) and a human-readable provenance note. Null workspace_id means
-- a pure OG Code DPP (default behaviour, visible under the subject gate only).
--
-- Lives in the analytics/OGCODE database alongside analytics.dpp_plans.
-- Idempotent; mirrored by the runtime-ensure DDL in src/legacy/analytics-store.ts.

ALTER TABLE analytics.dpp_plans ADD COLUMN IF NOT EXISTS workspace_id TEXT;
ALTER TABLE analytics.dpp_plans ADD COLUMN IF NOT EXISTS provenance_note TEXT;
CREATE INDEX IF NOT EXISTS idx_analytics_dpp_plans_workspace
  ON analytics.dpp_plans (user_id, workspace_id, completed, created_at DESC);
