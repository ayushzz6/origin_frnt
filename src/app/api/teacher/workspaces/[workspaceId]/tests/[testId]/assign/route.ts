import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { assignTestToBatches } from "@/server/workspaces/tests-service";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

export async function POST(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; testId: string }> },
) {
  try {
    requireFeatureEnabled("teacherTests");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner", "admin", "teacher",
    ]);
    const { testId } = await context.params;
    const body = await request.json();
    const parsed = z.object({
      batchIds: z.array(z.string()).min(1),
      scheduledStartAt: z.string().datetime().optional(),
      scheduledEndAt: z.string().datetime().optional(),
    }).parse(body);

    const assignments = await assignTestToBatches({
      actorUserId: ctx.auth.userId,
      workspaceId,
      testId,
      batchIds: parsed.batchIds,
      scheduledStartAt: parsed.scheduledStartAt ?? null,
      scheduledEndAt: parsed.scheduledEndAt ?? null,
      requestId: requestIdOf(request),
    });

    return teacherJson({ assignments }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}