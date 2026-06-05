/**
 * Phase 14 (F.3 + F.5): student-facing teacher-room surface for /connect.
 *
 *  • listJoinableConnectRooms — live teacher rooms the student may join because
 *    they're an active member of the room's batch ("My institutes" tab).
 *  • joinConnectRoomByMembership — a membership-gated join: a teacher_room with a
 *    batch_id can be joined directly (no 6-char code) by an active batch member.
 *    Batch membership IS the entitlement, re-verified here server-side.
 *
 * Reuses the existing room engine (`joinRoom`) and the Phase-12 membership check
 * (`isStudentInBatch`). Reads cross-schema under the same-physical-DB invariant
 * the teacher_room→batch FK already relies on (AGENTS.md).
 */

import { AuthzError } from "@/server/authz";
import { getRoomSummaryById, joinRoom, type RoomSummary } from "@/server/study-rooms";
import type { StoredUser } from "@/server/store";
import { isStudentInBatch } from "@/server/workspaces/batches";
import {
  listJoinableRoomsForStudent,
  type JoinableRoomForStudent,
} from "@/server/workspaces/teacher-rooms";

export async function listJoinableConnectRooms(studentId: string): Promise<JoinableRoomForStudent[]> {
  return listJoinableRoomsForStudent(studentId);
}

export async function joinConnectRoomByMembership(
  roomId: string,
  user: StoredUser,
): Promise<RoomSummary> {
  const room = await getRoomSummaryById(roomId);
  if (!room || room.room_kind !== "teacher_room") {
    throw new AuthzError(404, "Room not found.");
  }
  if (!room.workspace_id || !room.batch_id) {
    // A teacher_room without a batch cannot be joined by membership — it must be
    // entered with an invite code instead.
    throw new AuthzError(403, "This room can only be joined with an invite code.");
  }

  const isMember = await isStudentInBatch(room.workspace_id, room.batch_id, user.id);
  if (!isMember) {
    throw new AuthzError(403, "You are not enrolled in this room's batch.");
  }

  // joinRoom enforces lobby state + capacity and upserts the participant row.
  return joinRoom(roomId, user);
}
