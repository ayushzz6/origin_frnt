import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { removeAsset } from "@/server/workspaces/study-materials-service";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "../../../../../../_utils";

export async function DELETE(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; materialId: string; assetId: string }> },
) {
  try {
    requireFeatureEnabled("studyMaterials");
    const { workspaceId, materialId, assetId } = await context.params;
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner",
      "admin",
      "teacher",
      "content_manager",
    ]);
    const deleted = await removeAsset({
      workspaceId,
      materialId,
      assetId,
      actorUserId: ctx.auth.userId,
      requestId: requestIdOf(request),
    });
    if (!deleted) {
      return teacherJson({ detail: "Asset not found." }, { status: 404 });
    }
    return teacherJson({ success: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}
