-- Teacher Live Rooms — live presence signals on room participants.
--
-- `entered_test_at`  : when the participant first opened the test surface.
--                      Distinguishes "giving the test" from "in the room but
--                      not giving it" in the teacher's live student list.
-- `last_seen_at`     : most recent presence heartbeat (drives online/offline).
--
-- Idempotent + additive. Mirrored by the runtime-ensure block in
-- src/server/rooms-postgres.ts (ROOMS_SCHEMA_SQL), which auto-applies on first
-- use. Safe to re-run. Lives on the OGCODE pool (same physical DB as analytics.*).

ALTER TABLE rooms.room_participants ADD COLUMN IF NOT EXISTS entered_test_at TIMESTAMPTZ;
ALTER TABLE rooms.room_participants ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Teacher Live Rooms — join-code behaviour (Phase 2):
--   rotating  : a fresh 60s code is issued on expiry (strict cutover)
--   permanent : a single non-expiring code is reused
-- Default rotating; student rooms ignore this and keep their own 180s flow.
ALTER TABLE rooms.rooms ADD COLUMN IF NOT EXISTS code_mode TEXT NOT NULL DEFAULT 'rotating';

-- Teacher Live Rooms — participant search (Phase 3). pg_trgm accelerates the
-- ILIKE '%q%' search used by searchRoomParticipants(). Kept in the migration
-- (not the runtime-ensure) because CREATE EXTENSION needs a privileged role;
-- the search still works without the index (sequential scan) for small rooms.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_rp_name_trgm
  ON rooms.room_participants USING gin (display_name gin_trgm_ops);
