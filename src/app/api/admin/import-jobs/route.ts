/**
 * GET /api/admin/import-jobs
 *
 * Cross-workspace admin view of document import jobs.
 * Plan: 06-rbac-and-api-contracts.md ("Admin APIs"), 05-implementation-roadmap.md
 * (Phase 11 "import job monitor").
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { listAllImportJobsAdminService } from "@/server/workspaces/admin-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const JOB_STATUS_VALUES = new Set([
  "queued",
  "processing",
  "needs_review",
  "succeeded",
  "failed",
  "cancelled",
]);

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("adminControlCenter");
    await requireRole(request, ["admin"]);

    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
    const rawLimit = url.searchParams.get("limit");
    const status =
      rawStatus && JOB_STATUS_VALUES.has(rawStatus)
        ? (rawStatus as
            | "queued"
            | "processing"
            | "needs_review"
            | "succeeded"
            | "failed"
            | "cancelled")
        : undefined;
    const limit = rawLimit ? Math.min(Math.max(Number(rawLimit) || 0, 1), 200) : undefined;

    const jobs = await listAllImportJobsAdminService({ workspaceId, status, limit });
    return teacherJson({ jobs });
  } catch (error) {
    return handleTeacherError(error);
  }
}
