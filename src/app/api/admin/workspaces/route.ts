/**
 * GET /api/admin/workspaces — list workspaces with admin filters.
 *
 * Plan: V1/teacher-admin-launch-plan/06-rbac-and-api-contracts.md
 * ("Admin APIs"). Backs the admin workspace list view.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { searchWorkspacesService } from "@/server/workspaces/admin-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const VALID_TYPE = new Set(["personal", "institute"]);
const VALID_STATUS = new Set(["active", "suspended", "all"]);

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("adminControlCenter");
    await requireRole(request, ["admin"]);

    const url = new URL(request.url);
    const query = url.searchParams.get("query") ?? "";
    const rawType = url.searchParams.get("workspaceType");
    const rawStatus = url.searchParams.get("status");
    const rawLimit = url.searchParams.get("limit");

    const workspaceType =
      rawType && VALID_TYPE.has(rawType) ? (rawType as "personal" | "institute") : undefined;
    const status =
      rawStatus && VALID_STATUS.has(rawStatus)
        ? (rawStatus as "active" | "suspended" | "all")
        : undefined;
    const limit = rawLimit ? Math.min(Math.max(Number(rawLimit) || 0, 1), 200) : undefined;

    const workspaces = await searchWorkspacesService(query, { workspaceType, status }, limit);
    return teacherJson({ workspaces });
  } catch (error) {
    return handleTeacherError(error);
  }
}
