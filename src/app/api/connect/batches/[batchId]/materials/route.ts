/**
 * Student-side batch study-materials list (Batch Hub). Returns the materials the
 * teacher shared with this batch — files (R2 public URLs) and links — gated to
 * active members of the batch. Authenticated /api/connect prefix.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { getStudentBatchContext } from "@/server/workspaces/batch-messages-store";
import { getMaterialsVisibleToBatch } from "@/server/workspaces/study-materials-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

type Context = {
  params: Promise<{ batchId: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("teacherConnect");
    requireFeatureEnabled("studyMaterials");
    const { batchId } = await context.params;
    const ctx = await requireRole(request, ["student"]);
    const batch = await getStudentBatchContext(batchId, ctx.userId);
    if (!batch) {
      return teacherJson({ detail: "You are not a member of this batch." }, { status: 403 });
    }
    const materials = await getMaterialsVisibleToBatch(batch.workspaceId, batchId);
    return teacherJson({ materials, batch: { name: batch.batchName, subject: batch.subject } });
  } catch (error) {
    return handleTeacherError(error);
  }
}
