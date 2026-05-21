-- Rollback: Phase 7 study materials
DROP TABLE IF EXISTS content.study_material_assignments;
DROP TABLE IF EXISTS content.study_material_assets;
DROP TABLE IF EXISTS content.study_materials;
DROP TYPE IF EXISTS content.assignment_target;
DROP TYPE IF EXISTS content.material_type;
DROP TYPE IF EXISTS content.material_status;
DELETE FROM app.migrations WHERE id = '20260521_phase7_study_materials';
