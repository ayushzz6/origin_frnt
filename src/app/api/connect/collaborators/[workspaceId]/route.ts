/**
 * GET /api/connect/collaborators/[workspaceId] — one institute's public profile.
 *
 * Returns the public profile + its active offerings for ANY active institute
 * (not only approved collaborators) so Browse "View institute" works for all.
 * Paid Flow-2 enrollment stays collaboration-gated at checkout. teacherConnect;
 * student-only.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { getBrowsableInstituteProfile } from "@/server/connect/connect-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    requireFeatureEnabled("teacherConnect");
    await requireRole(request, ["student"]);
    const { workspaceId } = await context.params;
    const profile = await getBrowsableInstituteProfile(workspaceId);
    if (!profile) {
      return teacherJson({ detail: "Institute not found." }, { status: 404 });
    }
    return teacherJson({ collaborator: profile });
  } catch (error) {
    return handleTeacherError(error);
  }
}
