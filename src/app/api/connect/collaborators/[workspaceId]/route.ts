/**
 * GET /api/connect/collaborators/[workspaceId] — one collaborator's public profile.
 *
 * Returns the institute profile + its active offerings, but only when the workspace
 * is an ACTIVE collaborator (404 otherwise). Gated by teacherConnect; student-only.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { getCollaboratorProfile } from "@/server/connect/connect-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    requireFeatureEnabled("teacherConnect");
    await requireRole(request, ["student"]);
    const { workspaceId } = await context.params;
    const profile = await getCollaboratorProfile(workspaceId);
    if (!profile) {
      return teacherJson({ detail: "Collaborator not found." }, { status: 404 });
    }
    return teacherJson({ collaborator: profile });
  } catch (error) {
    return handleTeacherError(error);
  }
}
