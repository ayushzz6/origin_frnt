import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { getStudentTopicProfile } from "@/server/workspaces/analytics-store";

import {
  getWorkspaceId,
  handleTeacherError,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "../../../../../_utils";

export async function GET(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; studentId: string }> },
) {
  try {
    requireFeatureEnabled("teacherAnalytics");
    const { workspaceId, studentId } = await context.params;
    await requireWorkspaceMember(request, workspaceId);
    const url = new URL(request.url);
    const subject = url.searchParams.get("subject");
    const profiles = await getStudentTopicProfile(workspaceId, studentId, subject ?? undefined);
    return teacherJson({ profiles });
  } catch (error) {
    return handleTeacherError(error);
  }
}
