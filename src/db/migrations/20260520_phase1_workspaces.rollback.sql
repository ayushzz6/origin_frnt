-- Rollback for 20260520_phase1_workspaces.sql

DROP TABLE IF EXISTS app.audit_events;
DROP TABLE IF EXISTS app.workspace_codes;
DROP TABLE IF EXISTS app.workspace_members;
DROP TABLE IF EXISTS app.teacher_workspaces;

DROP TYPE IF EXISTS app.workspace_code_status;
DROP TYPE IF EXISTS app.workspace_code_type;
DROP TYPE IF EXISTS app.workspace_member_status;
DROP TYPE IF EXISTS app.workspace_member_role;
DROP TYPE IF EXISTS app.workspace_verification_status;
DROP TYPE IF EXISTS app.workspace_status;
DROP TYPE IF EXISTS app.teacher_workspace_type;

DELETE FROM app.migrations WHERE id = '20260520_phase1_workspaces';
