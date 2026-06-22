import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { getStudentTopicProfileLive } from "@/server/workspaces/batch-cohort-store";

import {
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
    const profiles = await getStudentTopicProfileLive(workspaceId, studentId, subject ?? undefined);
    return teacherJson({ profiles });
  } catch (error) {
    return handleTeacherError(error);
  }
}
