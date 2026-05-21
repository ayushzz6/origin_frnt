import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { getInstituteProfileService } from "@/server/workspaces/marketplace-service";

import { handleTeacherError, teacherJson } from "../../../teacher/_utils";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    requireFeatureEnabled("paidEnrollment");
    const { workspaceId } = await context.params;
    const profile = await getInstituteProfileService(workspaceId);
    if (!profile) {
      return teacherJson({ detail: "Institute not found or not public." }, { status: 404 });
    }
    return teacherJson({ profile });
  } catch (error) {
    return handleTeacherError(error);
  }
}
