import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { createRoom, listTeacherRooms } from "@/server/workspaces/teacher-rooms-service";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  batchId: z.string().optional(),
  teacherTestId: z.string().optional(),
  maxParticipants: z.number().int().min(1).max(100).optional(),
});

export async function GET(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("teacherRooms");
    const workspaceId = await getWorkspaceId(context);
    await requireWorkspaceMember(request, workspaceId);
    const url = new URL(request.url);
    const rooms = await listTeacherRooms(workspaceId, {
      batchId: url.searchParams.get("batchId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });
    return teacherJson({ rooms });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("teacherRooms");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner", "admin", "teacher",
    ]);
    const body = await parseJsonBody(request);
    const parsed = createSchema.parse(body);

    const room = await createRoom({
      actorUserId: ctx.auth.userId,
      workspaceId,
      name: parsed.name,
      batchId: parsed.batchId ?? null,
      teacherTestId: parsed.teacherTestId ?? null,
      maxParticipants: parsed.maxParticipants ?? 100,
      requestId: requestIdOf(request),
    });

    return teacherJson({ room }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}