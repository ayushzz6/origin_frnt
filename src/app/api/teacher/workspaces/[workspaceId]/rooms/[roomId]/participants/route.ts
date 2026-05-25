/**
 * Phase 6: live participants for a teacher-owned room.
 *
 * Reuses the legacy `getRoomParticipants` helper so the data shape
 * matches the student-side study room view. The route is read-only —
 * kicks/transfers still go through the existing /api/study-rooms/*
 * endpoints because the teacher acts as the room admin there.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { getTeacherRoomById } from "@/server/workspaces/teacher-rooms";
import { getRoomParticipants } from "@/server/study-rooms";

import {
  getWorkspaceId,
  handleTeacherError,
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
    await requireWorkspaceMember(request, workspaceId);
    const { roomId } = await context.params;

    const room = await getTeacherRoomById(workspaceId, roomId);
    if (!room) {
      return teacherJson({ detail: "Room not found." }, { status: 404 });
    }

    const participants = await getRoomParticipants(roomId);
    return teacherJson({ participants });
  } catch (error) {
    return handleTeacherError(error);
  }
}
