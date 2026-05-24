/**
 * GET /api/admin/import-jobs/[jobId]
 *
 * Admin detail view of a single document import job, including page +
 * question progress. Plan: 06-rbac-and-api-contracts.md.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { getImportJobAdminService } from "@/server/workspaces/admin-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    requireFeatureEnabled("adminControlCenter");
    await requireRole(request, ["admin"]);
    const { jobId } = await context.params;
    const job = await getImportJobAdminService(jobId);
    if (!job) {
      return teacherJson({ detail: "Import job not found." }, { status: 404 });
    }
    return teacherJson({ job });
  } catch (error) {
    return handleTeacherError(error);
  }
}
