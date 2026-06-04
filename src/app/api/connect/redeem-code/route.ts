/**
 * POST /api/connect/redeem-code — Flow 1 step 1.
 *
 * A student redeems an institute join code for an ACTIVE collaborator and is
 * enrolled `unassigned`. Returns the workspace, the enrollment, and the subjects
 * the student may then pick exactly one of (see /api/connect/grant-subject).
 * Gated by the teacherConnect flag; student-only.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { checkRateLimit, generalLimiter } from "@/lib/rate-limit";
import { redeemConnectCode } from "@/server/connect/connect-service";
import { JoinCodeError } from "@/server/workspaces/join";

import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";

const schema = z.object({ code: z.string().min(1).max(64) });

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("teacherConnect");
    const ctx = await requireRole(request, ["student"]);
    const limited = await checkRateLimit(generalLimiter, `connect-redeem:${ctx.userId}`);
    if (limited) return limited;
    const body = await parseJsonBody(request);
    const { code } = schema.parse(body);
    const result = await redeemConnectCode({
      studentId: ctx.userId,
      rawCode: code,
      requestId: requestIdOf(request),
    });
    return teacherJson(result, { status: result.isNew ? 201 : 200 });
  } catch (error) {
    if (error instanceof JoinCodeError) {
      return teacherJson({ detail: error.message }, { status: error.status });
    }
    return handleTeacherError(error);
  }
}
