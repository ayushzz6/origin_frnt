/**
 * Browser client for the Phase 14 teacher-connect API.
 * All mutating calls carry the double-submit CSRF header (see lib/csrf).
 */

import { csrfHeaders } from "@/lib/csrf";
import type { Subject } from "@/lib/entitlements";

export type ConnectOffering = {
  id: string;
  title: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  targetBatchId: string | null;
  status: string;
};

export type ConnectCollaborator = {
  workspaceId: string;
  displayName: string;
  city: string | null;
  state: string | null;
  country: string | null;
  subjects: string[];
  courses: string[];
  studentCount: number;
  batchCount: number;
  verified: boolean;
  activeOfferings: ConnectOffering[];
};

export type RedeemCodeResult = {
  workspace: { id: string; displayName: string };
  enrollment: { id: string; status: string };
  isNew: boolean;
  eligibleSubjects: Subject[];
};

async function parseError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { detail?: string } | null;
  return data?.detail ?? `Request failed with status ${res.status}`;
}

export async function redeemConnectCode(code: string): Promise<RedeemCodeResult> {
  const res = await fetch("/api/connect/redeem-code", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", ...csrfHeaders() },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as RedeemCodeResult;
}

export async function grantConnectSubject(workspaceId: string, subject: Subject): Promise<void> {
  const res = await fetch("/api/connect/grant-subject", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", ...csrfHeaders() },
    body: JSON.stringify({ workspaceId, subject }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export type ConnectCheckoutResponse =
  | { status: "pending"; detail: string }
  | {
      status: "ready";
      razorpayKeyId: string;
      batchSubscription: { subscriptionId: string; shortUrl: string | null };
      addonSubscriptions: { subject: Subject; subscriptionId: string; shortUrl: string | null }[];
    };

export async function createConnectCheckout(input: {
  workspaceId: string;
  offeringId: string;
  addonSubjects?: Subject[];
}): Promise<ConnectCheckoutResponse> {
  const res = await fetch("/api/connect/checkout", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", ...csrfHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok && res.status !== 202) throw new Error(await parseError(res));
  return (await res.json()) as ConnectCheckoutResponse;
}

export async function listConnectCollaborators(params?: {
  subject?: string;
  city?: string;
}): Promise<ConnectCollaborator[]> {
  const qs = new URLSearchParams();
  if (params?.subject) qs.set("subject", params.subject);
  if (params?.city) qs.set("city", params.city);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetch(`/api/connect/collaborators${suffix}`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { collaborators?: ConnectCollaborator[] };
  return data.collaborators ?? [];
}
