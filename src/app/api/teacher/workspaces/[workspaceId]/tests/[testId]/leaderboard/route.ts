import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { getTeacherTestLeaderboard, getTeacherTestResults } from "@/server/workspaces/tests-service";

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
    requireFeatureEnabled("teacherTests");
    const workspaceId = await getWorkspaceId(context);
    await requireWorkspaceMember(request, workspaceId);
    const { testId } = await context.params;
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");

    if (mode === "results") {
      const results = await getTeacherTestResults(workspaceId, testId);
      return teacherJson({ results });
    }

    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 50);
    const leaderboard = await getTeacherTestLeaderboard(workspaceId, testId, limit);
    return teacherJson({ leaderboard });
  } catch (error) {
    return handleTeacherError(error);
  }
}