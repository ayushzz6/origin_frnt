/**
 * POST /api/internal/connect-jobs/drain — connect background worker (cron).
 *
 * Drains queued connect jobs (enrollment-subscription transitions + offering plan
 * creation) and reconciles lapsed recurring subscriptions (grace-to-period-end
 * teardown). Authenticated by INTERNAL_CRON_TOKEN (middleware + handler). No-ops
 * when teacherConnect is off so it is safe to schedule before launch.
 */

import { NextResponse, type NextRequest } from "next/server";

import { requireInternal } from "@/server/authz";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { drainConnectJobs } from "@/server/connect/connect-jobs";
import { reconcileEnrollmentSubscriptions } from "@/server/connect/enrollment-subscription-service";

import { handleTeacherError } from "@/app/api/teacher/_utils";

export async function POST(request: NextRequest) {
  try {
    await requireInternal(request);
    if (!isFeatureEnabled("teacherConnect")) {
      return NextResponse.json({ ok: true, skipped: "teacherConnect disabled" });
    }
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 25, 1), 25);
    const drain = await drainConnectJobs(limit);
    const reconcile = await reconcileEnrollmentSubscriptions();
    return NextResponse.json({ ok: true, drain, reconcile });
  } catch (error) {
    return handleTeacherError(error);
  }
}
