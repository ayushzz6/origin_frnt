/**
 * Phase 6: room leaderboard for the teacher view.
 *
 * Mirrors the student-side /api/study-rooms/[id]/leaderboard endpoint
 * but enforces workspace membership instead of room membership. This
 * lets a teacher inspect the leaderboard without having to re-join
 * the room as a participant. The teacher *is* the room admin so
 * `getRoomLeaderboard` still passes its membership check.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { getTeacherRoomById } from "@/server/workspaces/teacher-rooms";
import { getRoomLeaderboard } from "@/server/study-rooms";

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
    const ctx = await requireWorkspaceMember(request, workspaceId);
    const { roomId } = await context.params;

    const room = await getTeacherRoomById(workspaceId, roomId);
    if (!room) {
      return teacherJson({ detail: "Room not found." }, { status: 404 });
    }

    const leaderboard = await getRoomLeaderboard(roomId, ctx.auth.userId);
    return teacherJson({ leaderboard });
  } catch (error) {
    return handleTeacherError(error);
  }
}
