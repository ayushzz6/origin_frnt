import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { submitToOgCode } from "@/server/workspaces/questions-service";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

export async function POST(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; questionId: string }> },
) {
  try {
    requireFeatureEnabled("questionBag");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner", "admin", "teacher", "content_manager",
    ]);
    const { questionId } = await context.params;

    const body = await parseJsonBody(request);
    const { attributionName } = z.object({
      attributionName: z.string().min(1),
    }).parse(body);

    const question = await submitToOgCode({
      actorUserId: ctx.auth.userId,
      workspaceId,
      questionId,
      attributionName,
      requestId: requestIdOf(request),
    });

    return teacherJson({ question });
  } catch (error) {
    return handleTeacherError(error);
  }
}