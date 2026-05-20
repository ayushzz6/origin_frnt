/**
 * Teacher rooms service layer.
 * Thin wrapper over the store that adds RBAC, audit, and workflow rules.
 */

import { AuthzError } from "@/server/authz";

import { recordAuditEvent } from "./audit";
import {
  createTeacherRoom,
  getTeacherRoomById,
  listTeacherRooms,
  updateTeacherRoom,
} from "./teacher-rooms";
import { getTestById } from "./tests-store";
import type { TeacherRoomSummary } from "./types";

export { listTeacherRooms };

export async function createRoom(
  input: {
    actorUserId: string;
    workspaceId: string;
    name: string;
    batchId?: string | null;
    teacherTestId?: string | null;
    maxParticipants?: number;
    requestId?: string | null;
  }
): Promise<TeacherRoomSummary> {
  if (!input.name.trim()) {
    throw new AuthzError(400, "Room name is required.");
  }

  if (input.teacherTestId) {
    const test = await getTestById(input.teacherTestId);
    if (!test) throw new AuthzError(404, "Test not found.");
    if (test.workspaceId !== input.workspaceId) throw new AuthzError(403, "Test does not belong to this workspace.");
    if (test.status !== "published" && test.status !== "scheduled" && test.status !== "draft") {
      throw new AuthzError(400, "Test must be published, scheduled, or in draft to use in a room.");
    }
  }

  const room = await createTeacherRoom({
    workspaceId: input.workspaceId,
    createdBy: input.actorUserId,
    name: input.name.trim(),
    batchId: input.batchId ?? null,
    teacherTestId: input.teacherTestId ?? null,
    roomKind: "teacher_room",
    maxParticipants: input.maxParticipants ?? 100,
  });

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "teacher_room",
    entityId: room.id,
    action: "room.created",
    after: room,
    requestId: input.requestId,
  });

  return room;
}

export async function configureRoomTest(input: {
  actorUserId: string;
  workspaceId: string;
  roomId: string;
  teacherTestId: string | null;
  requestId?: string | null;
}): Promise<TeacherRoomSummary> {
  const room = await getTeacherRoomById(input.workspaceId, input.roomId);
  if (!room) throw new AuthzError(404, "Room not found.");
  if (room.status !== "lobby") {
    throw new AuthzError(400, "Cannot configure test after room has started.");
  }
  if (room.adminUserId !== input.actorUserId) {
    throw new AuthzError(403, "Only the room admin can configure the test.");
  }

  if (input.teacherTestId) {
    const test = await getTestById(input.teacherTestId);
    if (!test) throw new AuthzError(404, "Test not found.");
    if (test.workspaceId !== input.workspaceId) throw new AuthzError(403, "Test does not belong to this workspace.");
  }

  const updated = await updateTeacherRoom(input.workspaceId, input.roomId, {
    teacherTestId: input.teacherTestId,
  });
  if (!updated) throw new Error("Failed to configure room test.");

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "teacher_room",
    entityId: input.roomId,
    action: "room.test_configured",
    after: updated,
    requestId: input.requestId,
  });

  return updated;
}

export async function closeTeacherRoom(input: {
  actorUserId: string;
  workspaceId: string;
  roomId: string;
  requestId?: string | null;
}): Promise<TeacherRoomSummary> {
  const room = await getTeacherRoomById(input.workspaceId, input.roomId);
  if (!room) throw new AuthzError(404, "Room not found.");
  if (room.adminUserId !== input.actorUserId) {
    throw new AuthzError(403, "Only the room admin can close the room.");
  }

  const updated = await updateTeacherRoom(input.workspaceId, input.roomId, { status: "closed" });
  if (!updated) throw new Error("Failed to close room.");

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "teacher_room",
    entityId: input.roomId,
    action: "room.closed",
    after: updated,
    requestId: input.requestId,
  });

  return updated;
}