-- Rollback for 20260525_remove_demo_seeds.sql
--
-- Demo accounts are intentionally not re-inserted by the rollback.
-- If a test environment needs them back, set
-- `ORIGIN_ALLOW_DEMO_SEEDS=1` and let the legacy store helper recreate
-- them on next boot.

SELECT 1;
