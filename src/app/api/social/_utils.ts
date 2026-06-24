import { NextResponse, type NextRequest } from "next/server";

import { AuthzError, authzErrorResponse, requireRole, type AuthContext } from "@/server/authz";
import { FeatureDisabledError, requireFeatureEnabled } from "@/lib/feature-flags";

/**
 * Shared helpers for the /api/social/* routes. Every handler must:
 *   1. requireFeatureEnabled("studentSocial")  — 404 when the flag is dark
 *   2. requireSocialUser(request)               — student-only auth context
 * and wrap its body in try/catch → handleSocialError.
 */

export class SocialError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireSocialUser(request: NextRequest): Promise<AuthContext> {
  requireFeatureEnabled("studentSocial");
  return requireRole(request, ["student"]);
}

export function socialJson<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function handleSocialError(error: unknown): NextResponse {
  if (error instanceof FeatureDisabledError) {
    return NextResponse.json({ detail: error.message }, { status: 404 });
  }
  if (error instanceof AuthzError) {
    return authzErrorResponse(error) as NextResponse;
  }
  if (error instanceof SocialError) {
    return NextResponse.json({ detail: error.message }, { status: error.status });
  }
  if (error instanceof Error) {
    const status = (error as { status?: number }).status ?? 400;
    return NextResponse.json({ detail: error.message }, { status });
  }
  console.error("[social api] unexpected error", error);
  return NextResponse.json({ detail: "Internal server error." }, { status: 500 });
}
