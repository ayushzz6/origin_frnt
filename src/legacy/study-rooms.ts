// Legacy study-room implementation kept behind the public server/study-rooms barrel.
import type { PoolClient } from "pg";

import {
  createCustomTest,
  getRoomTestDetail,
  submitTest,
  type CustomTestPayload,
  type TestSubmissionPayload,
} from "@/server/assessments";
import { getPersistedCustomTestById, persistGeneratedCustomTest } from "@/server/analytics-store";
import { getRoomsPostgresPoolOrThrow, ensureRoomsSchema } from "@/server/rooms-postgres";
import { getUserPostgresPool } from "@/server/user-postgres";
import {
  deleteActiveRoomCode,
  deleteRoomCode,
  getActiveRoomCode,
  getRoomCodeToken,
  setRoomCodeToken,
} from "@/server/rooms-redis";
import {
  generateRoomCode,
  hashRoomCode,
  normalizeRoomCode,
  ROOM_CODE_TTL_SECONDS,
  signRoomCodeToken,
  verifyRoomCodeToken,
} from "@/lib/study-rooms/code";
import type { ParticipantSummary, RoomMessage } from "@/lib/study-rooms/events";
import { createId, type AppStore, type StoredUser } from "@/server/store";

export type RoomStatus = "lobby" | "in_test" | "finished" | "closed";
export type ParticipantRole = "admin" | "participant";
export type RoomKind = "student_room" | "teacher_room";

export type RoomSummary = {
  id: string;
  name: string;
  admin_user_id: string;
  created_by: string;
  status: RoomStatus;
  custom_test_id: string | null;
  duration_seconds: number | null;
  started_at: string | null;
  ended_at: string | null;
  max_participants: number;
  created_at: string;
  updated_at: string;
  // Phase 14 (teacher rooms): a teacher_room is backed by an assessment.tests id
  // (`teacher_test_id`) instead of an analytics.custom_tests id, and carries the
  // cohort context (`workspace_id`/`batch_id`) used to tag room submissions.
  teacher_test_id: string | null;
  workspace_id: string | null;
  batch_id: string | null;
  room_kind: RoomKind;
  // Teacher Live Rooms: how the join code behaves. `rotating` issues a fresh
  // 60s code (strict cutover) for teacher rooms; `permanent` keeps a single
  // non-expiring code. Student rooms keep their own 180s flow regardless.
  code_mode: RoomCodeMode;
};

export type RoomCodeMode = "rotating" | "permanent";

/**
 * The test id backing a room's run: a student room uses `custom_test_id`
 * (analytics.custom_tests); a teacher room uses `teacher_test_id`
 * (assessment.tests). Exactly one is set once a test is configured.
 */
export function effectiveRoomTestId(room: RoomSummary): string | null {
  return room.custom_test_id ?? room.teacher_test_id ?? null;
}

function isTeacherRoom(room: RoomSummary): boolean {
  return room.room_kind === "teacher_room" || (!room.custom_test_id && Boolean(room.teacher_test_id));
}

export type RoomState = {
  room: RoomSummary;
  participants: ParticipantSummary[];
  messages: RoomMessage[];
  current_code: { code: string; ttl_seconds: number; expires_at: string } | null;
  is_admin: boolean;
};

export type RoomInviteCode = {
  code: string;
  ttl_seconds: number;
  expires_at: string;
  // Set for teacher rooms so the UI knows whether to show a rotation countdown.
  mode?: RoomCodeMode;
};

/** Rotating teacher-room codes live for 60s, then a fresh code is issued. */
export const ROOM_CODE_ROTATING_TTL_SECONDS = 60;
/** Permanent teacher-room codes use a long-lived token (~5 years). */
export const ROOM_CODE_PERMANENT_TTL_SECONDS = 60 * 60 * 24 * 365 * 5;

export type RoomLeaderboardRow = {
  rank: number;
  user_id: string;
  display_name: string;
  score: number | null;
  time_taken_seconds: number | null;
  finished_at: string | null;
  test_result_id: string | null;
  auto_submitted: boolean;
  is_me: boolean;
};

export type RoomDppPlanSummary = {
  id: string;
  title: string;
  subject: string;
  summary: string;
  weak_topics: unknown[];
  duration_minutes: number;
  target_question_count: number;
  sequence: number;
};

export class StudyRoomError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRoom(row: any): RoomSummary {
  return {
    id: row.id,
    name: row.name,
    admin_user_id: row.admin_user_id,
    created_by: row.created_by,
    status: row.status,
    custom_test_id: row.custom_test_id ?? null,
    duration_seconds: row.duration_seconds ?? null,
    started_at: toIso(row.started_at),
    ended_at: toIso(row.ended_at),
    max_participants: row.max_participants,
    created_at: toIso(row.created_at) ?? new Date().toISOString(),
    updated_at: toIso(row.updated_at) ?? new Date().toISOString(),
    teacher_test_id: row.teacher_test_id ?? null,
    workspace_id: row.workspace_id ?? null,
    batch_id: row.batch_id ?? null,
    room_kind: (row.room_kind as RoomKind) ?? "student_room",
    code_mode: (row.code_mode as RoomCodeMode) ?? "rotating",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapParticipant(row: any): ParticipantSummary {
  return {
    room_id: row.room_id,
    user_id: row.user_id,
    display_name: row.display_name,
    role: row.role,
    joined_at: toIso(row.joined_at) ?? new Date().toISOString(),
    left_at: toIso(row.left_at),
    kicked: Boolean(row.kicked),
    finished_at: toIso(row.finished_at),
    score: toNumber(row.score),
    rank: row.rank ?? null,
    time_taken_seconds: row.time_taken_seconds ?? null,
    test_result_id: row.test_result_id ?? null,
    auto_submitted: Boolean(row.auto_submitted),
    entered_test_at: toIso(row.entered_test_at),
    last_seen_at: toIso(row.last_seen_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMessage(row: any): RoomMessage {
  return {
    id: Number(row.id),
    room_id: row.room_id,
    user_id: row.user_id,
    display_name: row.display_name,
    content: row.content,
    created_at: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureRoomsSchema();
  const client = await getRoomsPostgresPoolOrThrow().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withClient(async (client) => {
    try {
      await client.query("BEGIN");
      await ensureRoomsSchema(client);
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

async function getRoomOrThrow(client: PoolClient, roomId: string, lock = false): Promise<RoomSummary> {
  const result = await client.query(`SELECT * FROM rooms.rooms WHERE id = $1 ${lock ? "FOR UPDATE" : ""}`, [roomId]);
  if (!result.rows[0]) {
    throw new StudyRoomError(404, "Study room was not found.");
  }
  return mapRoom(result.rows[0]);
}

/**
 * Phase 14: fetch a room summary WITHOUT requiring membership — used by the
 * connect membership-gated join, which decides eligibility from batch membership
 * (app.batch_members) rather than an existing room participant row.
 */
export async function getRoomSummaryById(roomId: string): Promise<RoomSummary | null> {
  return withClient(async (client) => {
    const result = await client.query(`SELECT * FROM rooms.rooms WHERE id = $1`, [roomId]);
    return result.rows[0] ? mapRoom(result.rows[0]) : null;
  });
}

export async function listRoomsForUser(userId: string): Promise<RoomSummary[]> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT r.*
       FROM rooms.rooms r
       JOIN rooms.room_participants p ON p.room_id = r.id
       WHERE p.user_id = $1 AND p.left_at IS NULL AND p.kicked = FALSE
       ORDER BY r.created_at DESC
       LIMIT 30`,
      [userId],
    );
    return result.rows.map(mapRoom);
  });
}

export async function createRoom(user: StoredUser, name: string): Promise<RoomSummary> {
  const trimmedName = name.trim();
  if (trimmedName.length < 2) {
    throw new StudyRoomError(400, "Room name must be at least 2 characters.");
  }

  return transaction(async (client) => {
    const roomId = createId("room");
    const result = await client.query(
      `INSERT INTO rooms.rooms (id, name, admin_user_id, created_by)
       VALUES ($1, $2, $3, $3)
       RETURNING *`,
      [roomId, trimmedName.slice(0, 120), user.id],
    );

    await client.query(
      `INSERT INTO rooms.room_participants (room_id, user_id, role, display_name)
       VALUES ($1, $2, 'admin', $3)`,
      [roomId, user.id, user.name],
    );

    return mapRoom(result.rows[0]);
  });
}

export async function requireRoomMembership(roomId: string, userId: string): Promise<ParticipantSummary> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT * FROM rooms.room_participants
       WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL AND kicked = FALSE`,
      [roomId, userId],
    );
    if (!result.rows[0]) {
      throw new StudyRoomError(403, "You are not an active participant in this room.");
    }
    return mapParticipant(result.rows[0]);
  });
}

export async function requireRoomAdmin(roomId: string, userId: string): Promise<ParticipantSummary> {
  const participant = await requireRoomMembership(roomId, userId);
  if (participant.role !== "admin") {
    throw new StudyRoomError(403, "Only the room admin can do this.");
  }
  return participant;
}

export async function getRoomParticipants(roomId: string): Promise<ParticipantSummary[]> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT * FROM rooms.room_participants
       WHERE room_id = $1
       ORDER BY joined_at ASC`,
      [roomId],
    );
    return result.rows.map(mapParticipant);
  });
}

/**
 * Teacher Live Rooms: server-side participant search. Ranks prefix matches
 * first, then any substring (case-insensitive). Uses ILIKE so it works with or
 * without the pg_trgm GIN index (the migration adds the index to keep it fast
 * at institution scale). An empty query returns the active participants.
 */
export async function searchRoomParticipants(roomId: string, query: string, limit = 50): Promise<ParticipantSummary[]> {
  const q = query.trim();
  if (!q) {
    const all = await getRoomParticipants(roomId);
    return all.filter((p) => !p.left_at && !p.kicked).slice(0, limit);
  }
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT * FROM rooms.room_participants
       WHERE room_id = $1 AND left_at IS NULL AND kicked = FALSE
         AND display_name ILIKE '%' || $2 || '%'
       ORDER BY (display_name ILIKE $2 || '%') DESC, display_name ASC
       LIMIT $3`,
      [roomId, q, Math.min(Math.max(limit, 1), 100)],
    );
    return result.rows.map(mapParticipant);
  });
}

/**
 * Teacher Live Rooms: record a presence heartbeat for an active participant.
 * Updates `last_seen_at` (drives online/offline) and, when the caller is on the
 * test surface, stamps `entered_test_at` once — this is what distinguishes
 * "giving the test" from "in the room but not giving it" in the teacher's live
 * student list. No-ops (returns false) for non-members. Cheap single-row UPDATE;
 * does not broadcast (the teacher dashboard reads liveness from the polled
 * participant list + SSE presence, so a heartbeat does not need to fan out).
 */
export async function recordRoomHeartbeat(
  roomId: string,
  userId: string,
  options: { onTest?: boolean } = {},
): Promise<boolean> {
  return withClient(async (client) => {
    const result = await client.query(
      `UPDATE rooms.room_participants
       SET last_seen_at = NOW(),
           entered_test_at = CASE
             WHEN $3::boolean AND entered_test_at IS NULL THEN NOW()
             ELSE entered_test_at
           END
       WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL AND kicked = FALSE`,
      [roomId, userId, options.onTest ?? false],
    );
    return (result.rowCount ?? 0) > 0;
  });
}

export async function getRoomMessages(roomId: string, limit = 50): Promise<RoomMessage[]> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT * FROM rooms.room_messages
       WHERE room_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [roomId, Math.min(Math.max(limit, 1), 100)],
    );
    return result.rows.map(mapMessage).reverse();
  });
}

async function persistRanks(client: PoolClient, roomId: string): Promise<void> {
  await client.query(
    `WITH ranked AS (
       SELECT
         room_id,
         user_id,
         RANK() OVER (
           ORDER BY COALESCE(score, -999999) DESC, COALESCE(time_taken_seconds, 2147483647) ASC, joined_at ASC
         )::int AS computed_rank
       FROM rooms.room_participants
       WHERE room_id = $1 AND left_at IS NULL AND kicked = FALSE
     )
     UPDATE rooms.room_participants p
     SET rank = ranked.computed_rank
     FROM ranked
     WHERE p.room_id = ranked.room_id AND p.user_id = ranked.user_id`,
    [roomId],
  );
}

async function autoFinishExpiredRoom(client: PoolClient, room: RoomSummary): Promise<RoomSummary> {
  if (room.status !== "in_test" || !room.started_at || !room.duration_seconds) {
    return room;
  }

  const deadline = new Date(new Date(room.started_at).getTime() + (room.duration_seconds + 10) * 1000);
  if (deadline > new Date()) {
    return room;
  }

  await client.query(
    `UPDATE rooms.room_participants
     SET finished_at = COALESCE(finished_at, NOW()),
         auto_submitted = CASE WHEN finished_at IS NULL THEN TRUE ELSE auto_submitted END,
         score = COALESCE(score, 0),
         time_taken_seconds = COALESCE(time_taken_seconds, $2)
     WHERE room_id = $1 AND left_at IS NULL AND kicked = FALSE AND finished_at IS NULL`,
    [room.id, room.duration_seconds],
  );

  await persistRanks(client, room.id);
  const updated = await client.query(
    `UPDATE rooms.rooms
     SET status = 'finished', ended_at = COALESCE(ended_at, NOW()), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [room.id],
  );
  return mapRoom(updated.rows[0]);
}

export async function getRoomState(roomId: string, userId: string): Promise<RoomState> {
  return transaction(async (client) => {
    await getRoomOrThrow(client, roomId, true);
    const membership = await client.query(
      `SELECT * FROM rooms.room_participants
       WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL AND kicked = FALSE`,
      [roomId, userId],
    );
    if (!membership.rows[0]) {
      throw new StudyRoomError(403, "You are not an active participant in this room.");
    }

    let room = await getRoomOrThrow(client, roomId);
    room = await autoFinishExpiredRoom(client, room);

    const participantsResult = await client.query(
      `SELECT * FROM rooms.room_participants
       WHERE room_id = $1
       ORDER BY joined_at ASC`,
      [roomId],
    );
    const messagesResult = await client.query(
      `SELECT * FROM rooms.room_messages
       WHERE room_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [roomId],
    );
    const isAdmin = membership.rows[0].role === "admin";
    const activeCode = isAdmin ? await getActiveRoomCode(roomId) : null;

    return {
      room,
      participants: participantsResult.rows.map(mapParticipant),
      messages: messagesResult.rows.map(mapMessage).reverse(),
      current_code: activeCode
        ? {
            code: activeCode.code,
            ttl_seconds: activeCode.ttlSeconds,
            expires_at: new Date(Date.now() + activeCode.ttlSeconds * 1000).toISOString(),
          }
        : null,
      is_admin: isAdmin,
    };
  });
}

/**
 * Teacher Live Rooms: server-side auto-stop safety net. Finalizes any room still
 * in `in_test` past its deadline (started_at + duration + 10s grace) that no
 * client has read since — auto-submits stragglers, settles ranks, flips the room
 * to `finished`. Returns the finalized room ids so the caller can broadcast
 * `test_ended`. The common case is already handled lazily on read by
 * {@link getRoomState}; this sweep covers fully-disconnected rooms.
 */
export async function sweepExpiredRooms(limit = 100): Promise<string[]> {
  return transaction(async (client) => {
    const due = await client.query(
      `SELECT id FROM rooms.rooms
       WHERE status = 'in_test'
         AND started_at IS NOT NULL
         AND duration_seconds IS NOT NULL
         AND NOW() > started_at + ((duration_seconds + 10) * INTERVAL '1 second')
       ORDER BY started_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [Math.min(Math.max(limit, 1), 500)],
    );
    const finalized: string[] = [];
    for (const row of due.rows) {
      const room = await getRoomOrThrow(client, row.id, true);
      const updated = await autoFinishExpiredRoom(client, room);
      if (updated.status === "finished") finalized.push(row.id);
    }
    return finalized;
  });
}

export async function getCurrentInviteCode(roomId: string, userId: string): Promise<RoomInviteCode | null> {
  await requireRoomAdmin(roomId, userId);
  const active = await getActiveRoomCode(roomId);
  return active
    ? {
        code: active.code,
        ttl_seconds: active.ttlSeconds,
        expires_at: new Date(Date.now() + active.ttlSeconds * 1000).toISOString(),
      }
    : null;
}

export async function generateInviteCode(
  roomId: string,
  userId: string,
  ttlSeconds: number = ROOM_CODE_TTL_SECONDS,
  mode?: RoomCodeMode,
): Promise<RoomInviteCode> {
  return transaction(async (client) => {
    const room = await getRoomOrThrow(client, roomId, true);
    if (room.status !== "lobby") {
      throw new StudyRoomError(423, "Invite codes can only be regenerated in the lobby.");
    }

    const adminResult = await client.query(
      `SELECT * FROM rooms.room_participants
       WHERE room_id = $1 AND user_id = $2 AND role = 'admin' AND left_at IS NULL AND kicked = FALSE`,
      [roomId, userId],
    );
    if (!adminResult.rows[0]) {
      throw new StudyRoomError(403, "Only the room admin can regenerate the invite code.");
    }

    const previous = await getActiveRoomCode(roomId);
    if (previous) {
      await deleteRoomCode(previous.code, roomId);
    }
    await client.query(
      `UPDATE rooms.room_codes SET revoked_at = NOW()
       WHERE room_id = $1 AND revoked_at IS NULL`,
      [roomId],
    );

    const nowSeconds = Math.floor(Date.now() / 1000);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateRoomCode();
      const codeId = createId("code");
      const jwt = signRoomCodeToken({
        room_id: roomId,
        code_id: codeId,
        iat: nowSeconds,
        exp: nowSeconds + ttlSeconds,
        v: 1,
      });
      const didSet = await setRoomCodeToken(code, jwt, roomId, ttlSeconds);
      if (!didSet) continue;

      const expiresAt = new Date((nowSeconds + ttlSeconds) * 1000).toISOString();
      await client.query(
        `INSERT INTO rooms.room_codes (id, room_id, code_hash, expires_at, issued_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [codeId, roomId, hashRoomCode(code), expiresAt, userId],
      );
      return { code, ttl_seconds: ttlSeconds, expires_at: expiresAt, mode };
    }

    throw new StudyRoomError(409, "Could not allocate a unique room code. Please retry.");
  });
}

/**
 * Teacher Live Rooms: current join code for the teacher card, lazily issuing a
 * fresh one so the client can simply poll. In `rotating` mode a new 60s code is
 * minted once the previous one expires (strict cutover); in `permanent` mode a
 * single long-lived code is reused. Codes are only minted while the room is in
 * the lobby — joins close once the test starts.
 */
export async function getOrRotateTeacherRoomCode(roomId: string, userId: string): Promise<RoomInviteCode | null> {
  await requireRoomAdmin(roomId, userId);
  const room = await getRoomSummaryById(roomId);
  if (!room) throw new StudyRoomError(404, "Study room was not found.");

  const active = await getActiveRoomCode(roomId);
  if (active) {
    return {
      code: active.code,
      ttl_seconds: active.ttlSeconds,
      expires_at: new Date(Date.now() + active.ttlSeconds * 1000).toISOString(),
      mode: room.code_mode,
    };
  }

  if (room.status !== "lobby") return null;
  const ttl = room.code_mode === "permanent" ? ROOM_CODE_PERMANENT_TTL_SECONDS : ROOM_CODE_ROTATING_TTL_SECONDS;
  return generateInviteCode(roomId, userId, ttl, room.code_mode);
}

/**
 * Teacher Live Rooms: switch a room between `rotating` (60s) and `permanent`
 * join-code modes and immediately mint a fresh code in the new mode. Lobby-only.
 */
export async function setTeacherRoomCodeMode(roomId: string, userId: string, mode: RoomCodeMode): Promise<RoomInviteCode> {
  await requireRoomAdmin(roomId, userId);
  await withClient(async (client) => {
    const result = await client.query(
      `UPDATE rooms.rooms SET code_mode = $2, updated_at = NOW()
       WHERE id = $1 AND status = 'lobby'
       RETURNING id`,
      [roomId, mode],
    );
    if (!result.rows[0]) {
      throw new StudyRoomError(423, "The room code mode can only be changed in the lobby.");
    }
  });
  const ttl = mode === "permanent" ? ROOM_CODE_PERMANENT_TTL_SECONDS : ROOM_CODE_ROTATING_TTL_SECONDS;
  return generateInviteCode(roomId, userId, ttl, mode);
}

/** Teacher Live Rooms: mint a fresh code in the room's current mode (manual regenerate). */
export async function regenerateTeacherRoomCode(roomId: string, userId: string): Promise<RoomInviteCode> {
  await requireRoomAdmin(roomId, userId);
  const room = await getRoomSummaryById(roomId);
  if (!room) throw new StudyRoomError(404, "Study room was not found.");
  const ttl = room.code_mode === "permanent" ? ROOM_CODE_PERMANENT_TTL_SECONDS : ROOM_CODE_ROTATING_TTL_SECONDS;
  return generateInviteCode(roomId, userId, ttl, room.code_mode);
}

/** Whether a code hash was ever issued for some room (used to tell "changed" from "wrong"). */
async function isKnownRoomCodeHash(normalizedCode: string): Promise<boolean> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT 1 FROM rooms.room_codes WHERE code_hash = $1 LIMIT 1`,
      [hashRoomCode(normalizedCode)],
    );
    return Boolean(result.rows[0]);
  });
}

export async function verifyInviteCode(code: string): Promise<{ roomId: string; codeId: string }> {
  const normalized = normalizeRoomCode(code);
  if (normalized.length !== 6) {
    throw new StudyRoomError(400, "Room code must be 6 characters.");
  }

  const token = await getRoomCodeToken(normalized);
  if (!token || !verifyRoomCodeToken(token)) {
    // A code we recognise but can no longer accept means it rotated/expired —
    // tell the student to ask for the new one rather than "invalid".
    if (await isKnownRoomCodeHash(normalized)) {
      throw new StudyRoomError(409, "This room code has changed. Ask your teacher for the latest code.");
    }
    throw new StudyRoomError(404, "Room code is invalid or expired.");
  }

  const payload = verifyRoomCodeToken(token)!;
  return { roomId: payload.room_id, codeId: payload.code_id };
}

export async function joinRoom(roomId: string, user: StoredUser): Promise<RoomSummary> {
  return transaction(async (client) => {
    const room = await getRoomOrThrow(client, roomId, true);
    if (room.status !== "lobby") {
      throw new StudyRoomError(423, "This room is no longer accepting participants.");
    }

    const existing = await client.query(
      `SELECT * FROM rooms.room_participants WHERE room_id = $1 AND user_id = $2`,
      [roomId, user.id],
    );
    if (existing.rows[0]?.kicked) {
      throw new StudyRoomError(403, "You were removed from this room.");
    }

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM rooms.room_participants
       WHERE room_id = $1 AND left_at IS NULL AND kicked = FALSE`,
      [roomId],
    );
    if (Number(countResult.rows[0]?.count ?? 0) >= room.max_participants && !existing.rows[0]) {
      throw new StudyRoomError(409, "This room is full.");
    }

    await client.query(
      `INSERT INTO rooms.room_participants (room_id, user_id, role, display_name)
       VALUES ($1, $2, 'participant', $3)
       ON CONFLICT (room_id, user_id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         left_at = NULL,
         kicked = FALSE,
         joined_at = CASE
           WHEN rooms.room_participants.left_at IS NULL THEN rooms.room_participants.joined_at
           ELSE NOW()
         END`,
      [roomId, user.id, user.name],
    );

    return room;
  });
}

export async function joinRoomByCode(code: string, user: StoredUser): Promise<RoomSummary> {
  const verified = await verifyInviteCode(code);
  return joinRoom(verified.roomId, user);
}

export async function closeRoom(roomId: string, userId: string): Promise<RoomSummary> {
  return transaction(async (client) => {
    await getRoomOrThrow(client, roomId, true);
    const admin = await client.query(
      `SELECT 1 FROM rooms.room_participants
       WHERE room_id = $1 AND user_id = $2 AND role = 'admin' AND left_at IS NULL AND kicked = FALSE`,
      [roomId, userId],
    );
    if (!admin.rows[0]) {
      throw new StudyRoomError(403, "Only the room admin can close the room.");
    }
    const active = await getActiveRoomCode(roomId);
    if (active) await deleteRoomCode(active.code, roomId);
    const result = await client.query(
      `UPDATE rooms.rooms SET status = 'closed', ended_at = COALESCE(ended_at, NOW()), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [roomId],
    );
    return mapRoom(result.rows[0]);
  });
}

export async function deleteRoom(roomId: string, adminUserId: string): Promise<RoomSummary> {
  const room = await transaction(async (client) => {
    const lockedRoom = await getRoomOrThrow(client, roomId, true);
    if (lockedRoom.admin_user_id !== adminUserId) {
      throw new StudyRoomError(403, "Only the room admin can delete the room.");
    }

    const admin = await client.query(
      `SELECT 1 FROM rooms.room_participants
       WHERE room_id = $1 AND user_id = $2 AND role = 'admin' AND left_at IS NULL AND kicked = FALSE`,
      [roomId, adminUserId],
    );
    if (!admin.rows[0]) {
      throw new StudyRoomError(403, "Only the active room admin can delete the room.");
    }

    await client.query(`DELETE FROM rooms.rooms WHERE id = $1`, [roomId]);
    return lockedRoom;
  });

  const activeCode = await getActiveRoomCode(roomId);
  if (activeCode) {
    await deleteRoomCode(activeCode.code, roomId);
  } else {
    await deleteActiveRoomCode(roomId);
  }

  return room;
}

export async function leaveRoom(roomId: string, userId: string): Promise<{ room: RoomSummary; new_admin_user_id: string | null }> {
  return transaction(async (client) => {
    const room = await getRoomOrThrow(client, roomId, true);
    const participant = await client.query(
      `SELECT * FROM rooms.room_participants
       WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL AND kicked = FALSE`,
      [roomId, userId],
    );
    if (!participant.rows[0]) {
      throw new StudyRoomError(403, "You are not an active participant in this room.");
    }

    await client.query(
      `UPDATE rooms.room_participants SET left_at = NOW()
       WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId],
    );

    const remaining = await client.query(
      `SELECT * FROM rooms.room_participants
       WHERE room_id = $1 AND left_at IS NULL AND kicked = FALSE
       ORDER BY joined_at ASC`,
      [roomId],
    );

    if (remaining.rows.length === 0) {
      const closed = await client.query(
        `UPDATE rooms.rooms SET status = 'closed', ended_at = COALESCE(ended_at, NOW()), updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [roomId],
      );
      return { room: mapRoom(closed.rows[0]), new_admin_user_id: null };
    }

    let newAdminUserId: string | null = null;
    if (participant.rows[0].role === "admin") {
      newAdminUserId = remaining.rows[0].user_id;
      await client.query(
        `UPDATE rooms.room_participants
         SET role = CASE WHEN user_id = $2 THEN 'admin'::rooms.participant_role ELSE 'participant'::rooms.participant_role END
         WHERE room_id = $1 AND left_at IS NULL AND kicked = FALSE`,
        [roomId, newAdminUserId],
      );
      await client.query(`UPDATE rooms.rooms SET admin_user_id = $2, updated_at = NOW() WHERE id = $1`, [
        roomId,
        newAdminUserId,
      ]);
    }

    return { room, new_admin_user_id: newAdminUserId };
  });
}

export async function transferAdmin(roomId: string, currentAdminId: string, newAdminUserId: string): Promise<void> {
  if (currentAdminId === newAdminUserId) {
    return;
  }

  await transaction(async (client) => {
    await getRoomOrThrow(client, roomId, true);
    const admin = await client.query(
      `SELECT 1 FROM rooms.room_participants
       WHERE room_id = $1 AND user_id = $2 AND role = 'admin' AND left_at IS NULL AND kicked = FALSE`,
      [roomId, currentAdminId],
    );
    if (!admin.rows[0]) {
      throw new StudyRoomError(403, "Only the room admin can transfer ownership.");
    }

    const target = await client.query(
      `SELECT 1 FROM rooms.room_participants
       WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL AND kicked = FALSE`,
      [roomId, newAdminUserId],
    );
    if (!target.rows[0]) {
      throw new StudyRoomError(400, "Target user is not an active participant.");
    }

    await client.query(
      `UPDATE rooms.room_participants
       SET role = CASE WHEN user_id = $2 THEN 'admin'::rooms.participant_role ELSE 'participant'::rooms.participant_role END
       WHERE room_id = $1 AND left_at IS NULL AND kicked = FALSE`,
      [roomId, newAdminUserId],
    );
    await client.query(`UPDATE rooms.rooms SET admin_user_id = $2, updated_at = NOW() WHERE id = $1`, [
      roomId,
      newAdminUserId,
    ]);
  });
}

export async function kickParticipant(roomId: string, adminUserId: string, targetUserId: string): Promise<void> {
  if (adminUserId === targetUserId) {
    throw new StudyRoomError(400, "Admins should leave the room instead of kicking themselves.");
  }

  await transaction(async (client) => {
    const room = await getRoomOrThrow(client, roomId, true);
    if (room.status !== "lobby") {
      throw new StudyRoomError(423, "Participants can only be kicked from the lobby.");
    }
    const admin = await client.query(
      `SELECT 1 FROM rooms.room_participants
       WHERE room_id = $1 AND user_id = $2 AND role = 'admin' AND left_at IS NULL AND kicked = FALSE`,
      [roomId, adminUserId],
    );
    if (!admin.rows[0]) {
      throw new StudyRoomError(403, "Only the room admin can kick participants.");
    }

    const result = await client.query(
      `UPDATE rooms.room_participants
       SET kicked = TRUE, left_at = NOW()
       WHERE room_id = $1 AND user_id = $2 AND role <> 'admin' AND left_at IS NULL
       RETURNING *`,
      [roomId, targetUserId],
    );
    if (!result.rows[0]) {
      throw new StudyRoomError(404, "Participant was not found.");
    }
  });
}

export async function sendRoomMessage(roomId: string, user: StoredUser, content: string): Promise<RoomMessage> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new StudyRoomError(400, "Message cannot be empty.");
  }
  if (trimmed.length > 1000) {
    throw new StudyRoomError(400, "Message is too long.");
  }

  return transaction(async (client) => {
    const room = await getRoomOrThrow(client, roomId, true);
    if (room.status !== "lobby") {
      throw new StudyRoomError(423, "Chat is locked after the test starts.");
    }

    const participant = await client.query(
      `SELECT 1 FROM rooms.room_participants
       WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL AND kicked = FALSE`,
      [roomId, user.id],
    );
    if (!participant.rows[0]) {
      throw new StudyRoomError(403, "You are not an active participant in this room.");
    }

    if (Math.random() < 0.01) {
      await client.query(`DELETE FROM rooms.room_messages WHERE created_at < NOW() - INTERVAL '24 hours'`);
    }

    const result = await client.query(
      `INSERT INTO rooms.room_messages (room_id, user_id, display_name, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [roomId, user.id, user.name, trimmed],
    );
    return mapMessage(result.rows[0]);
  });
}

type SerializedRoomTest = {
  id?: string;
  title?: string;
  description?: string;
  subject?: string;
  chapter?: string | null;
  difficulty?: string;
  duration?: number;
  questions?: Array<{ id?: string | null }>;
  questionIds?: string[];
  question_ids?: string[];
  focusTopics?: string[];
  focus_topics?: string[];
  generationSummary?: string;
  generation_summary?: string;
  recommendedTimePerQuestionSeconds?: number;
  recommended_time_per_question_seconds?: number;
};

function getRoomTestQuestionIds(test: SerializedRoomTest): string[] {
  const direct = test.questionIds ?? test.question_ids;
  if (Array.isArray(direct) && direct.length > 0) {
    return direct.filter((id): id is string => typeof id === "string" && id.length > 0);
  }

  return (test.questions ?? [])
    .map((question) => question.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

async function ensureRoomCustomTestIsPersisted(
  user: StoredUser,
  rawTest: unknown,
  payload: CustomTestPayload,
): Promise<void> {
  const test = rawTest as SerializedRoomTest;
  if (!test.id) {
    throw new StudyRoomError(500, "Custom test generation did not return a test id.");
  }

  const existing = await getPersistedCustomTestById(test.id);
  if (existing) {
    return;
  }

  const questionIds = getRoomTestQuestionIds(test);
  if (questionIds.length === 0) {
    throw new StudyRoomError(500, "Custom test generation did not return persisted questions.");
  }

  await persistGeneratedCustomTest({
    id: test.id,
    userId: user.id,
    subject: test.subject ?? (payload.subject ?? "mixed").toLowerCase(),
    chapter: test.chapter ?? payload.chapter?.trim() ?? null,
    difficulty: test.difficulty ?? (payload.difficulty ?? "medium").toLowerCase(),
    title: test.title ?? "Room Custom Test",
    description: test.description ?? "Custom practice set generated for a study room.",
    questionIds,
    durationMinutes: Math.max(1, Number(test.duration ?? Math.ceil(questionIds.length * 2))),
    focusTopics: test.focusTopics ?? test.focus_topics ?? [],
    generationSummary:
      test.generationSummary ??
      test.generation_summary ??
      "Generated from the local question bank because the analytics provider was unavailable.",
    recommendedTimePerQuestionSeconds:
      test.recommendedTimePerQuestionSeconds ??
      test.recommended_time_per_question_seconds ??
      120,
  });
}

export async function createCustomTestForRoom(
  store: AppStore,
  user: StoredUser,
  roomId: string,
  payload: CustomTestPayload,
) {
  const test = await createCustomTest(store, user, payload);
  const customTestId = (test as { id?: string }).id;
  if (!customTestId) {
    throw new StudyRoomError(500, "Custom test generation did not return a test id.");
  }
  await ensureRoomCustomTestIsPersisted(user, test, payload);

  await transaction(async (client) => {
    const room = await getRoomOrThrow(client, roomId, true);
    if (room.status !== "lobby") {
      throw new StudyRoomError(423, "Tests can only be configured in the lobby.");
    }
    const admin = await client.query(
      `SELECT 1 FROM rooms.room_participants
       WHERE room_id = $1 AND user_id = $2 AND role = 'admin' AND left_at IS NULL AND kicked = FALSE`,
      [roomId, user.id],
    );
    if (!admin.rows[0]) {
      throw new StudyRoomError(403, "Only the room admin can configure a test.");
    }
    await client.query(`UPDATE rooms.rooms SET custom_test_id = $2, updated_at = NOW() WHERE id = $1`, [
      roomId,
      customTestId,
    ]);
  });

  return test;
}

export async function startRoomTest(roomId: string, userId: string) {
  return transaction(async (client) => {
    const room = await getRoomOrThrow(client, roomId, true);
    const admin = await client.query(
      `SELECT 1 FROM rooms.room_participants
       WHERE room_id = $1 AND user_id = $2 AND role = 'admin' AND left_at IS NULL AND kicked = FALSE`,
      [roomId, userId],
    );
    if (!admin.rows[0]) {
      throw new StudyRoomError(403, "Only the room admin can start the test.");
    }

    const configuredTestId = effectiveRoomTestId(room);
    if (room.status !== "lobby") {
      if (room.status === "in_test" && configuredTestId && room.started_at && room.duration_seconds) {
        return {
          custom_test_id: configuredTestId,
          started_at: room.started_at,
          duration_seconds: room.duration_seconds,
          server_emit_ts: Date.now(),
        };
      }
      throw new StudyRoomError(423, "This room has already left the lobby.");
    }
    if (!configuredTestId) {
      throw new StudyRoomError(400, "Configure a test before starting.");
    }

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM rooms.room_participants
       WHERE room_id = $1 AND left_at IS NULL AND kicked = FALSE`,
      [roomId],
    );
    if (Number(countResult.rows[0]?.count ?? 0) < 1) {
      throw new StudyRoomError(400, "A room needs at least one active participant.");
    }

    // Resolve the configured test's duration. A student room reads
    // analytics.custom_tests (same OGCode pool as rooms.rooms). A teacher room
    // reads assessment.tests, which lives in the USER database — and in
    // production the USER and OGCode pools are SEPARATE physical DBs (the
    // rooms→assessment FK is added NOT VALID and skipped when undefined; see
    // teacher-rooms-schema.ts). Reading assessment.tests via the rooms (OGCode)
    // `client` therefore fails with `relation "assessment.tests" does not exist`,
    // so the teacher-room read must go through the USER pool.
    let durationMinutes: number | undefined;
    if (room.custom_test_id) {
      durationMinutes = (
        await client.query(`SELECT duration_minutes FROM analytics.custom_tests WHERE id = $1`, [room.custom_test_id])
      ).rows[0]?.duration_minutes;
    } else {
      const userPool = getUserPostgresPool();
      if (!userPool) {
        throw new StudyRoomError(500, "User database is not configured for teacher room tests.");
      }
      durationMinutes = (
        await userPool.query(`SELECT duration_minutes FROM assessment.tests WHERE id = $1`, [room.teacher_test_id])
      ).rows[0]?.duration_minutes;
    }
    if (durationMinutes === undefined) {
      throw new StudyRoomError(404, "Configured test was not found.");
    }

    const durationSeconds = Math.max(60, Number(durationMinutes ?? 1) * 60);
    const updated = await client.query(
      `UPDATE rooms.rooms
       SET status = 'in_test',
           duration_seconds = $2,
           started_at = NOW() + INTERVAL '3 seconds',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [roomId, durationSeconds],
    );
    const started = mapRoom(updated.rows[0]);
    return {
      custom_test_id: effectiveRoomTestId(started)!,
      started_at: started.started_at!,
      duration_seconds: started.duration_seconds!,
      server_emit_ts: Date.now(),
    };
  });
}

export async function getRoomTestForUser(store: AppStore, user: StoredUser, roomId: string) {
  const state = await getRoomState(roomId, user.id);
  const testId = effectiveRoomTestId(state.room);
  if (!testId || state.room.status === "lobby" || state.room.status === "closed") {
    throw new StudyRoomError(404, "Room test is not available yet.");
  }
  const test = await getRoomTestDetail(store, user, testId);
  return { room: state.room, test };
}

export async function finishRoomParticipant(
  roomId: string,
  userId: string,
  input: { testResultId: string | null; score: number | null; timeTakenSeconds?: number | null; autoSubmitted?: boolean },
) {
  return transaction(async (client) => {
    const room = await getRoomOrThrow(client, roomId, true);
    if (room.status !== "in_test" && room.status !== "finished") {
      throw new StudyRoomError(423, "Room test is not active.");
    }
    if (!room.started_at || !room.duration_seconds) {
      throw new StudyRoomError(400, "Room timer is not initialized.");
    }

    const participant = await client.query(
      `SELECT * FROM rooms.room_participants
       WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL AND kicked = FALSE
       FOR UPDATE`,
      [roomId, userId],
    );
    if (!participant.rows[0]) {
      throw new StudyRoomError(403, "You are not an active participant in this room.");
    }

    const elapsedSeconds = Math.max(0, Math.ceil((Date.now() - new Date(room.started_at).getTime()) / 1000));
    if (!input.autoSubmitted && elapsedSeconds > room.duration_seconds + 10) {
      throw new StudyRoomError(409, "The room timer has expired.");
    }

    const timeTakenSeconds = Math.min(
      Math.max(0, Math.round(input.timeTakenSeconds ?? elapsedSeconds)),
      room.duration_seconds + 10,
    );

    await client.query(
      `UPDATE rooms.room_participants
       SET finished_at = COALESCE(finished_at, NOW()),
           test_result_id = COALESCE($3, test_result_id),
           score = COALESCE($4, score, 0),
           time_taken_seconds = COALESCE($5, time_taken_seconds),
           auto_submitted = auto_submitted OR $6
       WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId, input.testResultId, input.score, timeTakenSeconds, Boolean(input.autoSubmitted)],
    );

    const unfinished = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM rooms.room_participants
       WHERE room_id = $1 AND left_at IS NULL AND kicked = FALSE AND finished_at IS NULL`,
      [roomId],
    );

    await persistRanks(client, roomId);
    const rankResult = await client.query(
      `SELECT rank FROM rooms.room_participants WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId],
    );

    let endedAt: string | null = null;
    if (Number(unfinished.rows[0]?.count ?? 0) === 0 && room.status !== "finished") {
      const finished = await client.query(
        `UPDATE rooms.rooms
         SET status = 'finished', ended_at = COALESCE(ended_at, NOW()), updated_at = NOW()
         WHERE id = $1
         RETURNING ended_at`,
        [roomId],
      );
      endedAt = toIso(finished.rows[0]?.ended_at);
    }

    return { rank: rankResult.rows[0]?.rank ?? undefined, ended_at: endedAt };
  });
}

export async function submitRoomTest(
  store: AppStore,
  user: StoredUser,
  roomId: string,
  payload: TestSubmissionPayload,
) {
  const state = await getRoomState(roomId, user.id);
  const testId = effectiveRoomTestId(state.room);
  if (state.room.status !== "in_test" || !testId) {
    throw new StudyRoomError(423, "Room test is not active.");
  }

  const result = await submitTest(store, user, testId, payload, {
    allowRoomParticipant: true,
    sourceType: "room_test",
    roomId,
    // Phase 14: teacher-room submissions carry the room's cohort so analytics.test_results
    // is tagged (workspace_id/batch_id) and Phase-2E cohort population fires. Null for
    // student rooms (no workspace) → resolved as a normal custom test, no cohort tag.
    roomCohort: isTeacherRoom(state.room)
      ? { workspaceId: state.room.workspace_id, batchId: state.room.batch_id }
      : null,
  });
  const testResultId = (result as { id?: string }).id ?? null;
  const finish = await finishRoomParticipant(roomId, user.id, {
    testResultId,
    score: Number((result as { score?: number }).score ?? 0),
    timeTakenSeconds: payload.timeTaken ?? payload.time_taken ?? null,
  });
  return { result, finish };
}

export async function getRoomLeaderboard(roomId: string, userId: string): Promise<RoomLeaderboardRow[]> {
  await requireRoomMembership(roomId, userId);
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT
         COALESCE(
           rank,
           RANK() OVER (
             ORDER BY COALESCE(score, -999999) DESC, COALESCE(time_taken_seconds, 2147483647) ASC, joined_at ASC
           )::int
         ) AS computed_rank,
         user_id,
         display_name,
         score,
         time_taken_seconds,
         finished_at,
         test_result_id,
         auto_submitted
       FROM rooms.room_participants
       WHERE room_id = $1 AND left_at IS NULL AND kicked = FALSE
       ORDER BY computed_rank ASC, joined_at ASC`,
      [roomId],
    );

    return result.rows.map((row) => ({
      rank: row.computed_rank,
      user_id: row.user_id,
      display_name: row.display_name,
      score: toNumber(row.score),
      time_taken_seconds: row.time_taken_seconds ?? null,
      finished_at: toIso(row.finished_at),
      test_result_id: row.test_result_id ?? null,
      auto_submitted: Boolean(row.auto_submitted),
      is_me: row.user_id === userId,
    }));
  });
}

export async function getRoomDppPlans(roomId: string, userId: string): Promise<RoomDppPlanSummary[]> {
  await requireRoomMembership(roomId, userId);
  return withClient(async (client) => {
    const participant = await client.query(
      `SELECT test_result_id FROM rooms.room_participants
       WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId],
    );
    const testResultId = participant.rows[0]?.test_result_id;
    if (!testResultId) {
      return [];
    }

    const result = await client.query(
      `SELECT id, title, subject, summary, weak_topics, duration_minutes, target_question_count, sequence
       FROM analytics.dpp_plans
       WHERE user_id = $1 AND source_test_result_id = $2
       ORDER BY sequence ASC, created_at ASC`,
      [userId, testResultId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      subject: row.subject,
      summary: row.summary,
      weak_topics: Array.isArray(row.weak_topics) ? row.weak_topics : [],
      duration_minutes: row.duration_minutes,
      target_question_count: row.target_question_count,
      sequence: row.sequence,
    }));
  });
}
