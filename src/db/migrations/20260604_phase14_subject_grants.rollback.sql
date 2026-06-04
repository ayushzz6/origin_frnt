-- Rollback for 20260604_phase14_subject_grants.sql
DROP TABLE IF EXISTS entitlements.subject_grants CASCADE;
DROP TYPE IF EXISTS entitlements.grant_status;
-- The schema is left in place; it is empty and harmless. Drop explicitly if needed:
-- DROP SCHEMA IF EXISTS entitlements CASCADE;
DELETE FROM app.migrations WHERE id = '20260604_phase14_subject_grants';
