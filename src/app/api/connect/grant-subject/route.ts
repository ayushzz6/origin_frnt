/**
 * POST /api/connect/grant-subject — Flow 1 step 2 (subject pick).
 *
 * After redeeming a collaborator code, the student unlocks ONE Origin subject as
 * a non-Razorpay, time-bound `teacher_code` grant. Entitlement is granted here
 * (Flow 1 takes no payment, so there is no webhook). Gated by teacherConnect;
 * student-only. Idempotent for the same subject.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { grantConnectSubject } from "@/server/connect/connect-service";
import { ALL_SUBJECTS } from "@/lib/entitlements";

import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";

const schema = z.object({
  workspaceId: z.string().min(1),
  subject: z.enum(ALL_SUBJECTS as [string, ...string[]]),
});

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("teacherConnect");
    const ctx = await requireRole(request, ["student"]);
    const body = await parseJsonBody(request);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.message }, { status: 400 });
    }
    const grant = await grantConnectSubject({
      studentId: ctx.userId,
      workspaceId: parsed.data.workspaceId,
      subject: parsed.data.subject,
      requestId: requestIdOf(request),
    });
    return teacherJson({ grant }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
