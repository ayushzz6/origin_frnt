/**
 * GET  /api/teacher/workspaces/[workspaceId]/collaboration — current request/status
 * POST /api/teacher/workspaces/[workspaceId]/collaboration — request a collaboration
 *
 * Institute owners/admins request to become an ORIGIN collaborator from their
 * workspace settings; a platform admin approves via /api/admin/collaborations.
 * Gated by teacherConnect; workspace-member enforced.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { getCollaboration, requestCollaboration } from "@/server/connect/collaboration-service";

import {
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "../../../_utils";

export async function GET(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("teacherConnect");
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(request, workspaceId);
    const collaboration = await getCollaboration(workspaceId);
    return teacherJson({ collaboration });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("teacherConnect");
    const { workspaceId } = await context.params;
    const ctx = await requireWorkspaceMember(request, workspaceId, ["owner", "admin"]);
    const collaboration = await requestCollaboration({
      workspaceId,
      actorUserId: ctx.auth.userId,
      requestId: requestIdOf(request),
    });
    return teacherJson({ collaboration }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
