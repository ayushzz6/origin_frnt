-- Rollback for 20260520_phase4_question_bag.sql

DROP TABLE IF EXISTS content.question_asset_links;
DROP TABLE IF EXISTS content.question_versions;
DROP TABLE IF EXISTS content.questions;
DROP TABLE IF EXISTS content.assets;

DROP TYPE IF EXISTS content.question_asset_purpose;
DROP TYPE IF EXISTS content.question_type;
DROP TYPE IF EXISTS content.question_status;
DROP TYPE IF EXISTS content.question_visibility;
DROP TYPE IF EXISTS content.question_owner_scope;
DROP TYPE IF EXISTS content.asset_kind;
DROP TYPE IF EXISTS content.asset_owner_type;

DELETE FROM app.migrations WHERE id = '20260520_phase4_question_bag';
