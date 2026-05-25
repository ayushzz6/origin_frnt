/**
 * Phase 6: invite code surface for teacher rooms.
 *
 * GET returns the room's currently-active invite code (or null if the
 * admin has not generated one yet). POST regenerates it. Both reuse
 * the legacy study-room invite helpers so the join flow that students
 * already use stays unchanged — the teacher just gets a way to
 * surface the code through the workspace UI.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { getTeacherRoomById } from "@/server/workspaces/teacher-rooms";
import { generateInviteCode, getCurrentInviteCode } from "@/server/study-rooms";

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

    const code = await getCurrentInviteCode(roomId, ctx.auth.userId);
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
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner", "admin", "teacher",
    ]);
    const { roomId } = await context.params;

    const room = await getTeacherRoomById(workspaceId, roomId);
    if (!room) {
      return teacherJson({ detail: "Room not found." }, { status: 404 });
    }

    const code = await generateInviteCode(roomId, ctx.auth.userId);
    await recordAuditEvent({
      actorUserId: ctx.auth.userId,
      workspaceId,
      entityType: "teacher_room",
      entityId: roomId,
      action: "room.invite_code_regenerated",
      after: { codeExpiresAt: code.expires_at },
      requestId: requestIdOf(request),
    });
    return teacherJson({ inviteCode: code });
  } catch (error) {
    return handleTeacherError(error);
  }
}
