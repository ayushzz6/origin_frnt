/**
 * Browser client for the Phase 13 per-subject subscription API.
 * All mutating calls carry the double-submit CSRF header (see lib/csrf).
 */

import { csrfHeaders } from "@/lib/csrf";
import type { Subject } from "@/lib/entitlements";

export type CreateSubscriptionResponse = {
  subscriptionId: string;
  razorpayKeyId: string;
  shortUrl: string | null;
};

export type MySubscription = {
  id: string;
  subject: Subject;
  status: string;
  currentPeriodEnd: string | null;
  shortUrl: string | null;
  amountMinor: number;
};

async function parseError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { detail?: string } | null;
  return data?.detail ?? `Request failed with status ${res.status}`;
}

export async function createSubscription(subject: Subject): Promise<CreateSubscriptionResponse> {
  const res = await fetch("/api/subscriptions?action=create_subscription", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", ...csrfHeaders() },
    body: JSON.stringify({ subject }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as CreateSubscriptionResponse;
}

export async function cancelSubscription(subject: Subject): Promise<void> {
  const res = await fetch("/api/subscriptions?action=cancel", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", ...csrfHeaders() },
    body: JSON.stringify({ subject }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function listMySubscriptions(): Promise<MySubscription[]> {
  const res = await fetch("/api/subscriptions", { method: "GET", credentials: "include" });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { subscriptions?: MySubscription[] };
  return data.subscriptions ?? [];
}
