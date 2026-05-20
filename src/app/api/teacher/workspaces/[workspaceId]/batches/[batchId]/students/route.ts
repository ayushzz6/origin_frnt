import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { addStudentsToBatches, listBatchMembers } from "@/server/workspaces/batches";

import {
  handleTeacherError,
  requestIdOf,
  teacherJson,
} from "@/app/api/teacher/_utils";

type Context = {
  params: Promise<{ workspaceId: string; batchId: string }>;
};

const schema = z.object({ studentIds: z.array(z.string()).min(1) });

export async function GET(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("batches");
    const { workspaceId, batchId } = await context.params;
    await requireWorkspaceMember(request, workspaceId);
    const students = await listBatchMembers(workspaceId, batchId);
    return teacherJson({ students });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("batches");
    const { workspaceId, batchId } = await context.params;
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner",
      "admin",
      "teacher",
    ]);
    const body = await parseJsonBody(request);
    const { studentIds } = schema.parse(body);
    const added = await addStudentsToBatches({
      workspaceId,
      batchIds: [batchId],
      studentIds,
      assignedBy: ctx.auth.userId,
    });
    await recordAuditEvent({
      actorUserId: ctx.auth.userId,
      workspaceId,
      entityType: "batch",
      entityId: batchId,
      action: "batch.students_added",
      after: { studentIds: added.map((m) => m.studentId) },
      requestId: requestIdOf(request),
    });
    return teacherJson({ added }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
