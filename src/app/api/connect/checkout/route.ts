/**
 * POST /api/connect/checkout — Flow 2 (in-app enrollment).
 *   body: { workspaceId, offeringId, addonSubjects?: Subject[] }
 *
 * Creates the recurring batch-tuition Razorpay subscription (+ optional Phase-1
 * subject add-on subscriptions) and returns the ids the browser opens. NO grant
 * or enrollment happens here — that is webhook-driven. Guard chain (active
 * collaborator → offering active → batch active) lives in the service. Gated by
 * teacherConnect; student-only.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { createConnectCheckout } from "@/server/connect/enrollment-subscription-service";
import { ALL_SUBJECTS } from "@/lib/entitlements";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const schema = z.object({
  workspaceId: z.string().min(1),
  offeringId: z.string().min(1),
  addonSubjects: z.array(z.enum(ALL_SUBJECTS as [string, ...string[]])).optional(),
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
    const result = await createConnectCheckout({
      studentId: ctx.userId,
      workspaceId: parsed.data.workspaceId,
      offeringId: parsed.data.offeringId,
      addonSubjects: parsed.data.addonSubjects,
    });
    const status = result.status === "pending" ? 202 : 201;
    return teacherJson(result, { status });
  } catch (error) {
    return handleTeacherError(error);
  }
}
