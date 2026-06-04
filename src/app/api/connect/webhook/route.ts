/**
 * POST /api/connect/webhook — Razorpay batch-tuition subscription webhook.
 *
 * Public at the edge (no session/bearer); authenticity is the HMAC signature in
 * `x-razorpay-signature`, verified here against RAZORPAY_WEBHOOK_SECRET. Idempotent
 * via commerce.subscription_webhook_events keyed on `x-razorpay-event-id`. NON-
 * BLOCKING: it verifies + records + enqueues a job, then returns fast — the enroll/
 * assign work runs in the connect-jobs drain, never inline here.
 */

import { NextResponse, type NextRequest } from "next/server";

import { verifyRazorpayWebhookSignature } from "@/server/payments/razorpay-client";
import { intakeConnectWebhook } from "@/server/connect/enrollment-subscription-service";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ detail: "Invalid signature." }, { status: 400 });
  }

  const eventId = request.headers.get("x-razorpay-event-id");
  if (!eventId) {
    return NextResponse.json({ detail: "Missing event id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const result = await intakeConnectWebhook(eventId, body as Record<string, unknown>);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    // 500 so Razorpay retries; the ledger keeps reprocessing idempotent.
    console.error("[connect webhook] processing failed", error);
    return NextResponse.json({ detail: "Webhook processing failed." }, { status: 500 });
  }
}
