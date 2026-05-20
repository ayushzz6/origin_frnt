import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceOwnerOrAdmin } from "@/server/workspaces/authz";
import { revokeCodeById } from "@/server/workspaces/codes";

import {
  handleTeacherError,
  requestIdOf,
  teacherJson,
} from "../../../../../_utils";

type Context = {
  params: Promise<{ workspaceId: string; codeId: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("orgCodes");
    const { workspaceId, codeId } = await context.params;
    const ctx = await requireWorkspaceOwnerOrAdmin(request, workspaceId);
    const revoked = await revokeCodeById({
      workspaceId,
      codeId,
      actorUserId: ctx.auth.userId,
      requestId: requestIdOf(request),
    });
    if (!revoked) {
      return teacherJson({ detail: "Code not found or already revoked." }, { status: 404 });
    }
    return teacherJson({ code: revoked });
  } catch (error) {
    return handleTeacherError(error);
  }
}
