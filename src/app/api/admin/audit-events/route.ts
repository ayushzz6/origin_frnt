import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { listAuditEventsService } from "@/server/workspaces/admin-service";

import { handleTeacherError, teacherJson } from "../../teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("adminControlCenter");
    await requireRole(request, ["admin"]);
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
    const entityType = url.searchParams.get("entityType") ?? undefined;
    const actorUserId = url.searchParams.get("actorUserId") ?? undefined;
    const action = url.searchParams.get("action") ?? undefined;
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    const events = await listAuditEventsService({
      workspaceId,
      entityType,
      actorUserId,
      action,
      limit: Math.min(limit, 200),
      offset,
    });
    return teacherJson({ events });
  } catch (error) {
    return handleTeacherError(error);
  }
}
