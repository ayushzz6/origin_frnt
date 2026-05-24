/**
 * POST /api/admin/workspaces/[workspaceId]/codes/[codeId]/revoke
 *
 * Platform-admin revocation of a leaked or compromised workspace code.
 * Plan: 06-rbac-and-api-contracts.md "Admin APIs".
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { adminRevokeWorkspaceCodeService } from "@/server/workspaces/admin-service";

import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; codeId: string }> },
) {
  try {
    requireFeatureEnabled("adminControlCenter");
    const auth = await requireRole(request, ["admin"]);
    const { workspaceId, codeId } = await context.params;
    const code = await adminRevokeWorkspaceCodeService({
      workspaceId,
      codeId,
      adminUserId: auth.userId,
      requestId: requestIdOf(request),
    });
    if (!code) {
      return teacherJson({ detail: "Code not found or already revoked." }, { status: 404 });
    }
    return teacherJson({ code });
  } catch (error) {
    return handleTeacherError(error);
  }
}
