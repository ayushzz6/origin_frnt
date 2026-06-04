/**
 * Shared server gate for the /connect route group. The whole section ships dark
 * behind the teacherConnect flag (→ 404 when off) and is student-only.
 */

import { notFound, redirect } from "next/navigation";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getServerFrontendUser } from "@/lib/auth-server";
import type { User } from "@/types";

export async function gateConnectStudent(): Promise<User> {
  if (!isFeatureEnabled("teacherConnect")) notFound();
  const user = await getServerFrontendUser();
  if (!user) redirect("/");
  if (user.role !== "student") redirect("/");
  return user;
}
