import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import {
  getTeacherRoomById,
  listTeacherRooms,
} from "@/server/workspaces/teacher-rooms";
import {
  configureRoomTest,
  closeTeacherRoom,
} from "@/server/workspaces/teacher-rooms-service";
import {
  getTeacherTestLeaderboard,
} from "@/server/workspaces/tests-service";

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
    await requireWorkspaceMember(request, workspaceId);
    const { roomId } = await context.params;
    const room = await getTeacherRoomById(workspaceId, roomId);
    if (!room) {
      return teacherJson({ detail: "Room not found or access denied." }, { status: 404 });
    }
    return teacherJson({ room });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function DELETE(
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

    const room = await closeTeacherRoom({
      actorUserId: ctx.auth.userId,
      workspaceId,
      roomId,
      requestId: requestIdOf(request),
    });

    return teacherJson({ room });
  } catch (error) {
    return handleTeacherError(error);
  }
}