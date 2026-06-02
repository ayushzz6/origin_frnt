/**
 * POST /api/subscriptions                       — create a subject subscription
 * POST /api/subscriptions?action=create_subscription {subject}
 * POST /api/subscriptions?action=cancel {subject} — cancel at cycle end
 * GET  /api/subscriptions                        — list caller's subscriptions
 *
 * Student-only (enforced here + by the authenticated route policy). Gated by
 * the premiumSubscriptions feature flag so the whole surface ships dark. CSRF
 * is enforced at the edge by middleware. Entitlement is granted only by the
 * webhook — this route never unlocks anything.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { ALL_SUBJECTS } from "@/lib/entitlements";
import {
  cancelSubjectSubscription,
  createSubjectSubscription,
  listMySubscriptions,
} from "@/server/subscriptions/subscriptions-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const SubjectSchema = z.object({
  subject: z.enum(ALL_SUBJECTS as [string, ...string[]]),
});

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("premiumSubscriptions");
    const ctx = await requireRole(request, ["student"]);
    const action = new URL(request.url).searchParams.get("action");
    const body = await parseJsonBody(request);
    const parsed = SubjectSchema.safeParse(body);
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.message }, { status: 400 });
    }
    const subject = parsed.data.subject as (typeof ALL_SUBJECTS)[number];

    if (action === "cancel") {
      await cancelSubjectSubscription({ userId: ctx.userId, subject });
      return teacherJson({ ok: true });
    }

    // Default action: create_subscription.
    const result = await createSubjectSubscription({ userId: ctx.userId, subject });
    return teacherJson(result, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("premiumSubscriptions");
    const ctx = await requireRole(request, ["student"]);
    const subscriptions = await listMySubscriptions(ctx.userId);
    return teacherJson({ subscriptions });
  } catch (error) {
    return handleTeacherError(error);
  }
}
