/**
 * Server-side auth helpers for React Server Components and Server Actions.
 *
 * Access cookies now contain short-lived JWTs. This module verifies the JWT,
 * then hydrates the user from Postgres or the local seed store only when page
 * rendering actually needs profile data.
 */

import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { cache } from "react";

import { getAuthenticatedUser } from "@/server/authz";
import { withEntitledSubjects } from "@/server/entitlements";
import { readStoreAsync } from "@/server/store";
import { serializeUser } from "@/server/users";
import type { StoredUser } from "@/server/store";
import type { User } from "@/types";

async function cookieBackedRequest(): Promise<Request> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
    .join("; ");
  return new Request("http://origin.local", {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
}

export const getServerUser = cache(async function getServerUser(): Promise<StoredUser | null> {
  return getAuthenticatedUser(await cookieBackedRequest());
});

// Cache the expensive store-read + entitlement computation per userId.
// JWT verification still runs on every request (getServerUser above) — only
// the store hydration + serialization is skipped on cache hits.
const getCachedFrontendUser = unstable_cache(
  async (userId: string): Promise<User | null> => {
    const store = await readStoreAsync();
    const payload = serializeUser(store, userId);
    if (!payload) return null;
    const enriched = await withEntitledSubjects(payload, userId);
    return (enriched as unknown as User) ?? null;
  },
  ["auth:frontend-user"],
  { revalidate: 10, tags: ["user-profile"] },
);

/**
 * Resolves the current request to a frontend-shape `User` suitable for
 * seeding `AuthProvider` in the root layout. Returns `null` when the user
 * is not authenticated.
 */
export async function getServerFrontendUser(): Promise<User | null> {
  const stored = await getServerUser();
  if (!stored) return null;
  return getCachedFrontendUser(stored.id);
}
