import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { getTestCohort, getTestWeakTopics } from "@/server/workspaces/tests-service";

import {
  getWorkspaceId,
  handleTeacherError,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

export async function GET(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; testId: string }> },
) {
  try {
    requireFeatureEnabled("teacherAnalytics");
    const workspaceId = await getWorkspaceId(context);
    await requireWorkspaceMember(request, workspaceId);
    const { testId } = await context.params;
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const batchId = url.searchParams.get("batchId");

    if (type === "weak-topics") {
      const weakTopics = await getTestWeakTopics(workspaceId, testId);
      return teacherJson({ weakTopics });
    }

    const attempts = await getTestCohort(workspaceId, testId, {
      batchId: batchId ?? undefined,
    });
    return teacherJson({ attempts });
  } catch (error) {
    return handleTeacherError(error);
  }
}
