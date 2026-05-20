import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { requireWorkspaceOwnerOrAdmin } from "@/server/workspaces/authz";
import { setEnrollmentStatus, getEnrollment } from "@/server/workspaces/enrollments";

import {
  handleTeacherError,
  requestIdOf,
  teacherJson,
} from "../../../../_utils";

type Context = {
  params: Promise<{ workspaceId: string; studentId: string }>;
};

const schema = z.object({
  status: z.enum(["active", "suspended", "left", "unassigned"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function PATCH(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("enrollment");
    const { workspaceId, studentId } = await context.params;
    const ctx = await requireWorkspaceOwnerOrAdmin(request, workspaceId);
    const body = await parseJsonBody(request);
    const parsed = schema.parse(body);
    const before = await getEnrollment(workspaceId, studentId);
    if (!before) {
      return teacherJson({ detail: "Enrollment not found." }, { status: 404 });
    }
    const updated = await setEnrollmentStatus(
      workspaceId,
      studentId,
      parsed.status ?? before.status,
      { notes: parsed.notes },
    );
    if (!updated) {
      return teacherJson({ detail: "Enrollment update failed." }, { status: 400 });
    }
    await recordAuditEvent({
      actorUserId: ctx.auth.userId,
      workspaceId,
      entityType: "workspace_student_enrollment",
      entityId: updated.id,
      action: "enrollment.updated",
      before,
      after: updated,
      requestId: requestIdOf(request),
    });
    return teacherJson({ enrollment: updated });
  } catch (error) {
    return handleTeacherError(error);
  }
}
