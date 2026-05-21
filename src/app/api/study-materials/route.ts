import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireAuth } from "@/server/authz";
import { getMaterialsVisibleToStudent } from "@/server/workspaces/study-materials-service";

import { handleTeacherError, requestIdOf, teacherJson } from "../teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("studyMaterials");
    const auth = await requireAuth(request);
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return teacherJson({ detail: "workspaceId query parameter is required." }, { status: 400 });
    }
    const materials = await getMaterialsVisibleToStudent(workspaceId, auth.userId);
    return teacherJson({ materials });
  } catch (error) {
    return handleTeacherError(error);
  }
}
