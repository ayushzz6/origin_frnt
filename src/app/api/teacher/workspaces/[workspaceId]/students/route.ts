import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { listEnrollments } from "@/server/workspaces/enrollments";
import type { EnrollmentStatus } from "@/server/workspaces/types";

import {
  getWorkspaceId,
  handleTeacherError,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "../../../_utils";

const ALLOWED_STATUSES: EnrollmentStatus[] = ["unassigned", "active", "suspended", "left"];

export async function GET(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("enrollment");
    const workspaceId = await getWorkspaceId(context);
    await requireWorkspaceMember(request, workspaceId, ["owner", "admin", "teacher", "content_manager", "analyst"]);
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const status =
      rawStatus && (ALLOWED_STATUSES.includes(rawStatus as EnrollmentStatus) || rawStatus === "all")
        ? (rawStatus as EnrollmentStatus | "all")
        : undefined;
    const students = await listEnrollments(workspaceId, { status });
    return teacherJson({ students });
  } catch (error) {
    return handleTeacherError(error);
  }
}
