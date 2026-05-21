-- Rollback for 20260521_phase9_ogcode_publishing.sql

DROP TABLE IF EXISTS content.ogcode_publications;
DROP TYPE IF EXISTS content.ogcode_publication_status;

DELETE FROM app.migrations WHERE id = '20260521_phase9_ogcode_publishing';
