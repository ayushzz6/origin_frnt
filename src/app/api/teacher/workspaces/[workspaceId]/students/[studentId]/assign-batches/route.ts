import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import {
  addStudentsToBatches,
  removeStudentFromBatch,
} from "@/server/workspaces/batches";

import {
  handleTeacherError,
  requestIdOf,
  teacherJson,
} from "@/app/api/teacher/_utils";

type Context = {
  params: Promise<{ workspaceId: string; studentId: string }>;
};

const schema = z.object({
  add: z.array(z.string()).optional(),
  remove: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("batches");
    const { workspaceId, studentId } = await context.params;
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner",
      "admin",
      "teacher",
    ]);
    const body = await parseJsonBody(request);
    const parsed = schema.parse(body);
    const added = parsed.add?.length
      ? await addStudentsToBatches({
          workspaceId,
          batchIds: parsed.add,
          studentIds: [studentId],
          assignedBy: ctx.auth.userId,
        })
      : [];
    const removedBatches: string[] = [];
    for (const batchId of parsed.remove ?? []) {
      const ok = await removeStudentFromBatch({ workspaceId, batchId, studentId });
      if (ok) removedBatches.push(batchId);
    }
    await recordAuditEvent({
      actorUserId: ctx.auth.userId,
      workspaceId,
      entityType: "workspace_student_enrollment",
      entityId: studentId,
      action: "enrollment.batches_changed",
      after: { added: added.map((m) => m.batchId), removed: removedBatches },
      requestId: requestIdOf(request),
    });
    return teacherJson({ added, removed: removedBatches });
  } catch (error) {
    return handleTeacherError(error);
  }
}
