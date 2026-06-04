-- Rollback for 20260604_phase14_collaborations.sql
DROP TABLE IF EXISTS app.origin_collaborations CASCADE;
DELETE FROM app.migrations WHERE id = '20260604_phase14_collaborations';
