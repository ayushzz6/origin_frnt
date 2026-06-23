import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { getTeacherRoomById } from "@/server/workspaces/teacher-rooms";
import {
  closeTeacherRoom,
  hardDeleteTeacherRoom,
} from "@/server/workspaces/teacher-rooms-service";
import { clearRoomEvents, publishRoomEvent } from "@/server/rooms-pubsub";

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

    // ?hard=1 → hybrid hard delete (reclaims space; analytics + DPPs survive).
    // Default → soft close (status = closed, room record kept).
    const hard = ["1", "true"].includes(new URL(request.url).searchParams.get("hard") ?? "");
    if (hard) {
      await hardDeleteTeacherRoom({
        actorUserId: ctx.auth.userId,
        workspaceId,
        roomId,
        requestId: requestIdOf(request),
      });
      await publishRoomEvent(roomId, { type: "room_closed" });
      await clearRoomEvents(roomId);
      return teacherJson({ deleted: true });
    }

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