/**
 * GET /api/marketplace/institutes
 * GET /api/marketplace/institutes/[workspaceId]
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { getInstituteProfileService, listPublicInstitutesService } from "@/server/workspaces/marketplace-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

type InstituteRouteContext = {
  params: Promise<{ workspaceId?: string }>;
};

export async function GET(request: NextRequest, context: InstituteRouteContext) {
  try {
    requireFeatureEnabled("paidEnrollment");
    const { workspaceId } = await context.params;
    if (workspaceId) {
      const profile = await getInstituteProfileService(workspaceId);
      if (!profile) return teacherJson({ error: "Institute not found" }, { status: 404 });
      return teacherJson(profile);
    }
    const url = new URL(request.url);
    const subject = url.searchParams.get("subject");
    const city = url.searchParams.get("city");
    const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined;
    const institutes = await listPublicInstitutesService({
      subject: subject ?? undefined,
      city: city ?? undefined,
      limit,
    });
    return teacherJson(institutes);
  } catch (error) {
    return handleTeacherError(error);
  }
}
