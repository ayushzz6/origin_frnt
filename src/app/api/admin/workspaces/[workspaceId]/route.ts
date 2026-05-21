import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import {
  closeWorkspaceService,
  suspendWorkspaceService,
  unsuspendWorkspaceService,
} from "@/server/workspaces/admin-service";

import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";

const actionSchema = z.object({
  action: z.enum(["suspend", "unsuspend", "close"]),
  reason: z.enum(["policy_violation", "fraud", "inactivity", "admin_request", "other"]).optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    requireFeatureEnabled("adminControlCenter");
    const auth = await requireRole(request, ["admin"]);
    const { workspaceId } = await context.params;
    const body = await parseJsonBody(request);
    const parsed = actionSchema.parse(body);

    let success: boolean;
    switch (parsed.action) {
      case "suspend":
        success = await suspendWorkspaceService({
          workspaceId,
          reason: parsed.reason ?? "admin_request",
          notes: parsed.notes,
          adminUserId: auth.userId,
          requestId: requestIdOf(request),
        });
        break;
      case "unsuspend":
        success = await unsuspendWorkspaceService({
          workspaceId,
          adminUserId: auth.userId,
          requestId: requestIdOf(request),
        });
        break;
      case "close":
        success = await closeWorkspaceService({
          workspaceId,
          adminUserId: auth.userId,
          requestId: requestIdOf(request),
        });
        break;
      default:
        return teacherJson({ detail: "Invalid action." }, { status: 400 });
    }

    return teacherJson({ success, action: parsed.action });
  } catch (error) {
    return handleTeacherError(error);
  }
}
