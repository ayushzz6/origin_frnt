/**
 * Invite code surface for teacher rooms (Phase 6 + Teacher Live Rooms).
 *
 * GET lazily returns the room's current join code, minting a fresh one when the
 * previous one has expired so the teacher card can simply poll — 60s rotating
 * codes (strict cutover) or a single permanent code, per the room's `code_mode`.
 * POST mints a fresh code in the current mode, and (when a `mode` is supplied)
 * switches the room between rotating and permanent first. All reuse the legacy
 * study-room invite helpers so the student join flow stays unchanged.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { parseJsonBody } from "@/server/http";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { getTeacherRoomById } from "@/server/workspaces/teacher-rooms";
import {
  getOrRotateTeacherRoomCode,
  regenerateTeacherRoomCode,
  setTeacherRoomCodeMode,
  type RoomCodeMode,
} from "@/server/study-rooms";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

export async function GET(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; roomId: string }> },
) {
  try {
    requireFeatureEnabled("teacherRooms");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId);
    const { roomId } = await context.params;

    const room = await getTeacherRoomById(workspaceId, roomId);
    if (!room) {
      return teacherJson({ detail: "Room not found." }, { status: 404 });
    }

    const code = await getOrRotateTeacherRoomCode(roomId, ctx.auth.userId);
    return teacherJson({ inviteCode: code });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; roomId: string }> },
) {
  try {
    requireFeatureEnabled("teacherRooms");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, ["owner", "admin", "teacher"]);
    const { roomId } = await context.params;

    const room = await getTeacherRoomById(workspaceId, roomId);
    if (!room) {
      return teacherJson({ detail: "Room not found." }, { status: 404 });
    }

    const body = await parseJsonBody<{ mode?: RoomCodeMode }>(request).catch(() => ({} as { mode?: RoomCodeMode }));
    const mode = body.mode === "permanent" || body.mode === "rotating" ? body.mode : null;

    const code = mode
      ? await setTeacherRoomCodeMode(roomId, ctx.auth.userId, mode)
      : await regenerateTeacherRoomCode(roomId, ctx.auth.userId);

    await recordAuditEvent({
      actorUserId: ctx.auth.userId,
      workspaceId,
      entityType: "teacher_room",
      entityId: roomId,
      action: mode ? "room.code_mode_changed" : "room.invite_code_regenerated",
      after: { codeMode: code.mode ?? null, codeExpiresAt: code.expires_at },
      requestId: requestIdOf(request),
    });
    return teacherJson({ inviteCode: code });
  } catch (error) {
    return handleTeacherError(error);
  }
}
