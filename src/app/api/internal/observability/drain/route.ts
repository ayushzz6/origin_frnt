/**
 * POST /api/internal/observability/drain
 *
 * Phase 13 — receiver stub for the Vercel log drain contract.
 *
 *   https://vercel.com/docs/observability/log-drains-overview
 *
 * Vercel signs every request body with HMAC-SHA1 using the drain secret
 * and puts the digest hex in the `x-vercel-signature` header. We verify
 * with constant-time compare and log the event count, then return 200.
 * Storing the events themselves is intentionally out of scope — adding
 * an `observability.events` table can come in a follow-up if drain
 * volume warrants it.
 *
 * Required env: DRAIN_SECRET. Without it, every request is rejected
 * with 503 to make a misconfigured drain visible immediately.
 *
 * The route is internal-prefixed but bypasses the INTERNAL_CRON_TOKEN
 * bearer check because Vercel's drain contract uses the request body
 * signature instead of a static bearer token.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { metric } from "@/lib/metrics";

const SIGNATURE_HEADER = "x-vercel-signature";
const HMAC_ALGO = "sha1";

function readSecret(): string | null {
  const raw = process.env.DRAIN_SECRET?.trim();
  return raw && raw.length > 0 ? raw : null;
}

function timingSafeHexEqual(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  } catch {
    return false;
  }
}

function computeSignature(secret: string, body: string): string {
  return createHmac(HMAC_ALGO, secret).update(body).digest("hex");
}

/**
 * Counts events in a Vercel-shaped body. The contract permits both
 * a JSON array of events and an NDJSON body (one event per line).
 * Falling back to "unknown" when the body is neither shape is fine —
 * the drain is a no-op anyway.
 */
function eventCount(body: string): number | "unknown" {
  const trimmed = body.trim();
  if (!trimmed) return 0;
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.length : "unknown";
    } catch {
      return "unknown";
    }
  }
  // NDJSON: one event per line.
  return trimmed.split("\n").filter((l) => l.trim().length > 0).length;
}

export async function POST(request: NextRequest) {
  const secret = readSecret();
  if (!secret) {
    return NextResponse.json(
      { detail: "DRAIN_SECRET is not configured." },
      { status: 503 },
    );
  }

  const signatureHeader = request.headers.get(SIGNATURE_HEADER);
  if (!signatureHeader) {
    return NextResponse.json(
      { detail: `Missing ${SIGNATURE_HEADER} header.` },
      { status: 401 },
    );
  }

  const body = await request.text();
  const expected = computeSignature(secret, body);
  if (!timingSafeHexEqual(signatureHeader, expected)) {
    metric("origin.drain.signature_invalid");
    return NextResponse.json(
      { detail: "Invalid drain signature." },
      { status: 401 },
    );
  }

  const count = eventCount(body);
  metric("origin.drain.received", { count: typeof count === "number" ? count : -1 });
  if (process.env.DRAIN_LOG_BODY === "1") {
    console.warn(`[drain] ${count} events: ${body.slice(0, 1000)}`);
  } else {
    console.warn(`[drain] ${count} events accepted`);
  }

  return NextResponse.json({ accepted: true, count });
}

/** Helpers exported for unit tests. Not part of the public route surface. */
export const __test = {
  computeSignature,
  timingSafeHexEqual,
  eventCount,
};
