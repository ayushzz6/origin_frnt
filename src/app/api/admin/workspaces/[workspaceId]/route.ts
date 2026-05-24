import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import {
  closeWorkspaceService,
  suspendWorkspaceService,
  unsuspendWorkspaceService,
  updateWorkspaceAdminService,
} from "@/server/workspaces/admin-service";
import { getWorkspaceById } from "@/server/workspaces/store";

import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";

const actionSchema = z.object({
  action: z.enum(["suspend", "unsuspend", "close"]),
  reason: z.enum(["policy_violation", "fraud", "inactivity", "admin_request", "other"]).optional(),
  notes: z.string().max(500).nullable().optional(),
});

const patchSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  legalName: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().min(2).max(8).optional(),
  subjects: z.array(z.string()).optional(),
  courses: z.array(z.string()).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    requireFeatureEnabled("adminControlCenter");
    await requireRole(request, ["admin"]);
    const { workspaceId } = await context.params;
    const workspace = await getWorkspaceById(workspaceId);
    if (!workspace) {
      return teacherJson({ detail: "Workspace not found." }, { status: 404 });
    }
    return teacherJson({ workspace });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    requireFeatureEnabled("adminControlCenter");
    const auth = await requireRole(request, ["admin"]);
    const { workspaceId } = await context.params;
    const body = await parseJsonBody(request);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.message }, { status: 400 });
    }
    const workspace = await updateWorkspaceAdminService({
      workspaceId,
      patch: parsed.data,
      adminUserId: auth.userId,
      requestId: requestIdOf(request),
    });
    if (!workspace) {
      return teacherJson({ detail: "Workspace not found." }, { status: 404 });
    }
    return teacherJson({ workspace });
  } catch (error) {
    return handleTeacherError(error);
  }
}

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
