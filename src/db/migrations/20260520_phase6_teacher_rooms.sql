-- Phase 6: Teacher Rooms - extend rooms.rooms with workspace/batch/test fields
-- See V1/teacher-admin-launch-plan/02-database-schema-design.md and 03-system-architecture.md

ALTER TABLE rooms.rooms
  ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_id TEXT REFERENCES app.batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS teacher_test_id TEXT REFERENCES assessment.tests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS room_kind TEXT NOT NULL DEFAULT 'student_room';

CREATE INDEX IF NOT EXISTS idx_rooms_workspace_status
  ON rooms.rooms(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_batch_status
  ON rooms.rooms(batch_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_teacher_test
  ON rooms.rooms(teacher_test_id) WHERE teacher_test_id IS NOT NULL;

INSERT INTO app.migrations (id, name)
VALUES ('20260520_phase6_teacher_rooms', 'phase 6 teacher rooms')
ON CONFLICT (id) DO NOTHING;