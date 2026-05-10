/**
 * Server-side auth helpers for React Server Components and Server Actions.
 *
 * Access cookies now contain short-lived JWTs. This module verifies the JWT,
 * then hydrates the user from Postgres or the local seed store only when page
 * rendering actually needs profile data.
 */

import { cookies } from "next/headers";

import { getAuthenticatedUser } from "@/server/authz";
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

export async function getServerUser(): Promise<StoredUser | null> {
  return getAuthenticatedUser(await cookieBackedRequest());
}

/**
 * Resolves the current request to a frontend-shape `User` suitable for
 * seeding `AuthProvider` in the root layout. Returns `null` when the user
 * is not authenticated.
 */
export async function getServerFrontendUser(): Promise<User | null> {
  const stored = await getServerUser();
  if (!stored) return null;

  const store = await readStoreAsync();
  const payload = serializeUser(store, stored.id);
  return (payload as unknown as User) ?? null;
}
