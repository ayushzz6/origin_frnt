/**
 * POST /api/subscriptions/webhook — Razorpay subscription webhook receiver.
 *
 * Public at the edge (no session/bearer); authenticity is the HMAC signature
 * in `x-razorpay-signature`, verified here against RAZORPAY_WEBHOOK_SECRET.
 * Idempotent via the subscriptions.webhook_events ledger keyed on
 * `x-razorpay-event-id`. This is the ONLY place subject entitlement is granted.
 *
 * See PREMIUM_AND_TEACHER_CONNECTION_PLAN.md (Phase 1.2).
 */

import { NextResponse, type NextRequest } from "next/server";

import { verifyRazorpayWebhookSignature } from "@/server/payments/razorpay-client";
import { processSubscriptionWebhook } from "@/server/subscriptions/subscriptions-service";

export async function POST(request: NextRequest) {
  // Raw body is required for an exact HMAC match — read it before any parse.
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
    const result = await processSubscriptionWebhook(eventId, body as Record<string, unknown>);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    // 500 so Razorpay retries; the ledger keeps reprocessing idempotent.
    console.error("[subscriptions webhook] processing failed", error);
    return NextResponse.json({ detail: "Webhook processing failed." }, { status: 500 });
  }
}
