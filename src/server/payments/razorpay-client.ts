/**
 * Shared Razorpay server client + webhook signature verification (Phase 1.2).
 *
 * Lives under payments/ (not subscriptions/) so the teacher marketplace can
 * reuse the same client and signature helper in Phase 2. The client is
 * server-only; the browser uses checkout.razorpay.com/v1/checkout.js directly.
 *
 * See PREMIUM_AND_TEACHER_CONNECTION_PLAN.md (Phase 1.2).
 */

import crypto from "node:crypto";

import Razorpay from "razorpay";

let cachedClient: Razorpay | null = null;
let cachedKeyId: string | null = null;

function readKey(name: "RAZORPAY_KEY_ID" | "RAZORPAY_KEY_SECRET" | "RAZORPAY_WEBHOOK_SECRET"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be configured before Razorpay can be used.`);
  }
  return value;
}

/** Memoised Razorpay client. Throws if key id/secret are not configured. */
export function getRazorpayClient(): Razorpay {
  const keyId = readKey("RAZORPAY_KEY_ID");
  const keySecret = readKey("RAZORPAY_KEY_SECRET");
  if (cachedClient && cachedKeyId === keyId) return cachedClient;
  cachedClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
  cachedKeyId = keyId;
  return cachedClient;
}

/** The publishable key id forwarded to the browser checkout. */
export function getRazorpayKeyId(): string {
  return readKey("RAZORPAY_KEY_ID");
}

/**
 * Verifies a Razorpay webhook HMAC. Razorpay signs the raw request body with
 * RAZORPAY_WEBHOOK_SECRET (HMAC-SHA256) and sends the hex digest in the
 * `x-razorpay-signature` header. Uses a constant-time comparison.
 */
export function verifyRazorpayWebhookSignature(rawBody: string, signature: string | null | undefined): boolean {
  if (!signature) return false;
  let secret: string;
  try {
    secret = readKey("RAZORPAY_WEBHOOK_SECRET");
  } catch {
    return false;
  }
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/** Test-only: drop the memoised client so a re-keyed env is picked up. */
export function __resetRazorpayClientForTests(): void {
  cachedClient = null;
  cachedKeyId = null;
}
