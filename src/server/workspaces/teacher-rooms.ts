/**
 * Teacher Rooms store: workspace-scoped room creation and management.
 * Reuses the existing rooms.* tables, adding workspace/batch/teacher_test scoping.
 */

import type { PoolClient } from "pg";

import { getRoomsPostgresPoolOrThrow, ensureRoomsSchema } from "@/server/rooms-postgres";

import { ensureTeacherRoomsSchema } from "./teacher-rooms-schema";
import { createPrefixedId } from "./ids";
import type { TeacherRoomSummary, RoomKind } from "./types";

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureTeacherRoomsSchema();
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

function rowToTeacherRoom(row: Record<string, unknown>): TeacherRoomSummary {
  return {
    id: row.id as string,
    name: row.name as string,
    adminUserId: row.admin_user_id as string,
    createdBy: row.created_by as string,
    status: row.status as "lobby" | "in_test" | "finished" | "closed",
    teacherTestId: (row.teacher_test_id as string | null) ?? null,
    durationSeconds: (row.duration_seconds as number | null) ?? null,
    startedAt: row.started_at ? new Date(row.started_at as string).toISOString() : null,
    endedAt: row.ended_at ? new Date(row.ended_at as string).toISOString() : null,
    maxParticipants: Number(row.max_participants) || 100,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    workspaceId: (row.workspace_id as string | null) ?? null,
    batchId: (row.batch_id as string | null) ?? null,
    roomKind: (row.room_kind as RoomKind) ?? "student_room",
  };
}

export type CreateTeacherRoomInput = {
  workspaceId: string;
  createdBy: string;
  name: string;
  batchId?: string | null;
  teacherTestId?: string | null;
  roomKind?: RoomKind;
  maxParticipants?: number;
};

export async function createTeacherRoom(input: CreateTeacherRoomInput): Promise<TeacherRoomSummary> {
  return transaction(async (client) => {
    const roomId = createPrefixedId("room");
    const kind = input.roomKind ?? "teacher_room";
    const result = await client.query(
      `INSERT INTO rooms.rooms (
         id, name, admin_user_id, created_by, workspace_id, batch_id,
         teacher_test_id, room_kind, max_participants
       ) VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        roomId,
        input.name.slice(0, 120),
        input.createdBy,
        input.workspaceId,
        input.batchId ?? null,
        input.teacherTestId ?? null,
        kind,
        input.maxParticipants ?? 100,
      ],
    );
    await client.query(
      `INSERT INTO rooms.room_participants (room_id, user_id, role, display_name)
       VALUES ($1, $2, 'admin', 'Teacher')`,
      [roomId, input.createdBy],
    );
    return rowToTeacherRoom(result.rows[0]);
  });
}

export async function getTeacherRoomById(
  workspaceId: string,
  roomId: string,
): Promise<TeacherRoomSummary | null> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT * FROM rooms.rooms
       WHERE id = $1 AND workspace_id = $2`,
      [roomId, workspaceId],
    );
    return result.rows[0] ? rowToTeacherRoom(result.rows[0]) : null;
  });
}

export async function listTeacherRooms(
  workspaceId: string,
  filter?: { batchId?: string; status?: string },
): Promise<TeacherRoomSummary[]> {
  return withClient(async (client) => {
    const params: unknown[] = [workspaceId];
    let i = 1;
    let where = `workspace_id = $${i++}`;
    if (filter?.batchId) {
      params.push(filter.batchId);
      where += ` AND batch_id = $${i++}`;
    }
    if (filter?.status) {
      params.push(filter.status);
      where += ` AND status = $${i++}`;
    }
    const result = await client.query(
      `SELECT * FROM rooms.rooms
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT 50`,
      params,
    );
    return result.rows.map(rowToTeacherRoom);
  });
}

export async function updateTeacherRoom(
  workspaceId: string,
  roomId: string,
  patch: {
    name?: string;
    teacherTestId?: string | null;
    batchId?: string | null;
    status?: "lobby" | "in_test" | "finished" | "closed";
  },
): Promise<TeacherRoomSummary | null> {
  return withClient(async (client) => {
    const fields: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (patch.name !== undefined) {
      fields.push(`name = $${i++}`);
      params.push(patch.name.slice(0, 120));
    }
    if (patch.teacherTestId !== undefined) {
      fields.push(`teacher_test_id = $${i++}`);
      params.push(patch.teacherTestId);
    }
    if (patch.batchId !== undefined) {
      fields.push(`batch_id = $${i++}`);
      params.push(patch.batchId);
    }
    if (patch.status !== undefined) {
      fields.push(`status = $${i++}`);
      params.push(patch.status);
    }
    if (fields.length === 0) {
      return getTeacherRoomById(workspaceId, roomId);
    }
    fields.push("updated_at = NOW()");
    params.push(roomId, workspaceId);
    const result = await client.query(
      `UPDATE rooms.rooms
       SET ${fields.join(", ")}
       WHERE id = $${i++} AND workspace_id = $${i}
       RETURNING *`,
      params,
    );
    return result.rows[0] ? rowToTeacherRoom(result.rows[0]) : null;
  });
}