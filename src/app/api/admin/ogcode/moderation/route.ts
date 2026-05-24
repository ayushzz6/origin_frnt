/**
 * GET /api/admin/ogcode/moderation
 *
 * Platform-admin moderation queue for OGCode publication submissions.
 * Plan: 06-rbac-and-api-contracts.md ("Admin APIs"). Replaces the legacy
 * /api/teacher/ogcode-moderation surface (kept for backwards-compat).
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { getModerationQueue } from "@/server/workspaces/ogcode-publishing-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("ogcodePublishing");
    await requireRole(request, ["admin"]);
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const queue = await getModerationQueue(Math.min(Math.max(limit, 1), 200));
    return teacherJson({ queue });
  } catch (error) {
    return handleTeacherError(error);
  }
}
