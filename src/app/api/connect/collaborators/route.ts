/**
 * GET /api/connect/collaborators — list ACTIVE collaborator institutes.
 *
 * Student-facing browse for Flow 2 (and discovery). Filterable by subject + city.
 * Gated by teacherConnect; student-only.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { listActiveCollaborators } from "@/server/connect/connect-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("teacherConnect");
    await requireRole(request, ["student"]);
    const url = new URL(request.url);
    const subject = url.searchParams.get("subject") ?? undefined;
    const city = url.searchParams.get("city") ?? undefined;
    const rawLimit = url.searchParams.get("limit");
    const limit = rawLimit ? Math.min(Math.max(Number(rawLimit) || 0, 1), 100) : undefined;
    const collaborators = await listActiveCollaborators({ subject, city, limit });
    return teacherJson({ collaborators });
  } catch (error) {
    return handleTeacherError(error);
  }
}
