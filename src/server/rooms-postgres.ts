import type { Pool, PoolClient } from "pg";

import { ensureAnalyticsSchema } from "@/server/analytics-store";
import { getOgcodePostgresPool } from "@/server/postgres";

declare global {
  var __originRoomsSchemaReady: Promise<void> | undefined;
}

const ROOMS_SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS rooms;

DO $$
BEGIN
  CREATE TYPE rooms.room_status AS ENUM ('lobby','in_test','finished','closed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE rooms.participant_role AS ENUM ('admin','participant');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS rooms.rooms (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  admin_user_id     TEXT NOT NULL,
  created_by        TEXT NOT NULL,
  status            rooms.room_status NOT NULL DEFAULT 'lobby',
  custom_test_id    TEXT REFERENCES analytics.custom_tests(id) ON DELETE SET NULL,
  duration_seconds  INTEGER,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  max_participants  INTEGER NOT NULL DEFAULT 100 CHECK (max_participants <= 100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_admin ON rooms.rooms(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms.rooms(status);

CREATE TABLE IF NOT EXISTS rooms.room_participants (
  room_id            TEXT NOT NULL REFERENCES rooms.rooms(id) ON DELETE CASCADE,
  user_id            TEXT NOT NULL,
  role               rooms.participant_role NOT NULL DEFAULT 'participant',
  display_name       TEXT NOT NULL,
  joined_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at            TIMESTAMPTZ,
  kicked             BOOLEAN NOT NULL DEFAULT FALSE,
  finished_at        TIMESTAMPTZ,
  score              NUMERIC(7,3),
  rank               INTEGER,
  time_taken_seconds INTEGER,
  test_result_id     TEXT REFERENCES analytics.test_results(id) ON DELETE SET NULL,
  auto_submitted     BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rp_room_active ON rooms.room_participants(room_id) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rp_user ON rooms.room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_rp_leaderboard ON rooms.room_participants(room_id, score DESC, time_taken_seconds ASC);

CREATE TABLE IF NOT EXISTS rooms.room_codes (
  id          TEXT PRIMARY KEY,
  room_id     TEXT NOT NULL REFERENCES rooms.rooms(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  issued_by   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rc_room_active ON rooms.room_codes(room_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rc_code_hash ON rooms.room_codes(code_hash);

CREATE TABLE IF NOT EXISTS rooms.room_messages (
  id           BIGSERIAL PRIMARY KEY,
  room_id      TEXT NOT NULL REFERENCES rooms.rooms(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  display_name TEXT NOT NULL,
  content      TEXT NOT NULL CHECK (char_length(content) <= 1000),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rm_room_recent ON rooms.room_messages(room_id, created_at DESC);

CREATE TABLE IF NOT EXISTS rooms.room_answer_drafts (
  room_id    TEXT NOT NULL REFERENCES rooms.rooms(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  answers    JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);
`;

export function getRoomsPostgresPool(): Pool | null {
  return getOgcodePostgresPool();
}

export function getRoomsPostgresPoolOrThrow(): Pool {
  const pool = getRoomsPostgresPool();
  if (!pool) {
    throw new Error("DATABASE_URL or OGCODE_DATABASE_URL is required for study rooms.");
  }
  return pool;
}

export async function ensureRoomsSchema(client?: PoolClient): Promise<void> {
  if (client) {
    await ensureAnalyticsSchema(client);
    await client.query(ROOMS_SCHEMA_SQL);
    return;
  }

  if (!globalThis.__originRoomsSchemaReady) {
    globalThis.__originRoomsSchemaReady = (async () => {
      const pool = getRoomsPostgresPoolOrThrow();
      await ensureAnalyticsSchema();
      await pool.query(ROOMS_SCHEMA_SQL);
    })().catch((error) => {
      globalThis.__originRoomsSchemaReady = undefined;
      throw error;
    });
  }

  await globalThis.__originRoomsSchemaReady;
}
