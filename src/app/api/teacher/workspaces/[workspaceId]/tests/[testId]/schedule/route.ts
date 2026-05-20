import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { publishTeacherTest, scheduleTeacherTest } from "@/server/workspaces/tests-service";

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
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    let test;
    if (action === "publish") {
      test = await publishTeacherTest({
        actorUserId: ctx.auth.userId,
        workspaceId,
        testId,
        requestId: requestIdOf(request),
      });
    } else if (action === "schedule") {
      const body = await request.json();
      const { scheduledStartAt, scheduledEndAt } = z.object({
        scheduledStartAt: z.string().datetime(),
        scheduledEndAt: z.string().datetime(),
      }).parse(body);
      test = await scheduleTeacherTest({
        actorUserId: ctx.auth.userId,
        workspaceId,
        testId,
        scheduledStartAt,
        scheduledEndAt,
        requestId: requestIdOf(request),
      });
    } else {
      return teacherJson({ detail: "Invalid action. Use ?action=publish or ?action=schedule" }, { status: 400 });
    }

    return teacherJson({ test });
  } catch (error) {
    return handleTeacherError(error);
  }
}