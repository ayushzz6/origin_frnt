-- Rollback for 20260520_phase6_teacher_rooms.sql

DROP INDEX IF EXISTS rooms.idx_rooms_teacher_test;
DROP INDEX IF EXISTS rooms.idx_rooms_batch_status;
DROP INDEX IF EXISTS rooms.idx_rooms_workspace_status;

ALTER TABLE rooms.rooms
  DROP COLUMN IF EXISTS room_kind,
  DROP COLUMN IF EXISTS teacher_test_id,
  DROP COLUMN IF EXISTS batch_id,
  DROP COLUMN IF EXISTS workspace_id;

DELETE FROM app.migrations WHERE id = '20260520_phase6_teacher_rooms';
