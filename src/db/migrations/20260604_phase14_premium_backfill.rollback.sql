-- Rollback for 20260604_phase14_premium_backfill.sql
-- Removes only the admin_comp comps created by the cutover backfill. teacher_code
-- grants (created by real Flow-1 redemptions) are left untouched. After this you
-- should re-run recomputeUserPremiumFlags for affected users if you intend to keep
-- the legacy is_premium mirror consistent.
DELETE FROM entitlements.subject_grants WHERE source = 'admin_comp';
DELETE FROM app.migrations WHERE id = '20260604_phase14_premium_backfill';
