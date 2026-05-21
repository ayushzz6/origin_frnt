/**
 * GET /api/marketplace/institutes(?subject=&city=&limit=)
 * Public institute directory.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { listPublicInstitutesService } from "@/server/workspaces/marketplace-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("paidEnrollment");
    const url = new URL(request.url);
    const subject = url.searchParams.get("subject");
    const city = url.searchParams.get("city");
    const rawLimit = url.searchParams.get("limit");
    const limit = rawLimit ? Math.min(Math.max(Number(rawLimit) || 0, 1), 100) : undefined;
    const institutes = await listPublicInstitutesService({
      subject: subject ?? undefined,
      city: city ?? undefined,
      limit,
    });
    return teacherJson({ institutes });
  } catch (error) {
    return handleTeacherError(error);
  }
}
