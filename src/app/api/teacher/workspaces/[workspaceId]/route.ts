import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import {
  loadWorkspaceContext,
  requireWorkspaceOwnerOrAdmin,
} from "@/server/workspaces/authz";
import { patchTeacherWorkspace } from "@/server/workspaces/service";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

const patchSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  legalName: z.string().max(160).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  state: z.string().max(80).nullable().optional(),
  country: z.string().length(2).optional(),
  subjects: z.array(z.string().max(40)).optional(),
  courses: z.array(z.string().max(80)).optional(),
});

export async function GET(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("workspaces");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await loadWorkspaceContext(request, workspaceId);
    return teacherJson({
      workspace: ctx.workspace,
      membership: ctx.membership,
      role: ctx.effectiveRole,
    });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function PATCH(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("workspaces");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceOwnerOrAdmin(request, workspaceId);
    const body = await parseJsonBody(request);
    const patch = patchSchema.parse(body);
    const updated = await patchTeacherWorkspace({
      actorUserId: ctx.auth.userId,
      workspaceId,
      ...patch,
      requestId: requestIdOf(request),
    });
    return teacherJson({ workspace: updated });
  } catch (error) {
    return handleTeacherError(error);
  }
}
