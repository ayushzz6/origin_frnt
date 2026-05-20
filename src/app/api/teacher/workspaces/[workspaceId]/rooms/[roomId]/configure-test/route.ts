import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { configureRoomTest } from "@/server/workspaces/teacher-rooms-service";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

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
    const body = await parseJsonBody(request);
    const parsed = z.object({
      teacherTestId: z.string().nullable(),
    }).parse(body);

    const room = await configureRoomTest({
      actorUserId: ctx.auth.userId,
      workspaceId,
      roomId,
      teacherTestId: parsed.teacherTestId,
      requestId: requestIdOf(request),
    });

    return teacherJson({ room });
  } catch (error) {
    return handleTeacherError(error);
  }
}