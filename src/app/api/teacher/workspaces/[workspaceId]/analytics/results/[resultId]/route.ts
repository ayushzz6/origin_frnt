import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { getCohortStudentResult } from "@/server/workspaces/tests-service";

import {
  handleTeacherError,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

export async function GET(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; resultId: string }> },
) {
  try {
    requireFeatureEnabled("teacherAnalytics");
    const { workspaceId, resultId } = await context.params;
    await requireWorkspaceMember(request, workspaceId);
    const result = await getCohortStudentResult(workspaceId, resultId);
    return teacherJson({ result });
  } catch (error) {
    return handleTeacherError(error);
  }
}
