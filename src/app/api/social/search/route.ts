/**
 * GET /api/social/search?q=<query>&limit=<n>
 * Student search by @username or display name, annotated with follow state.
 * Excludes the viewer. Empty/blank query returns [].
 */

import type { NextRequest } from "next/server";

import { generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import { searchStudents } from "@/server/social/social-service";
import { requireSocialUser, socialJson, handleSocialError } from "@/app/api/social/_utils";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireSocialUser(request);
    const limited = await checkRateLimit(generalLimiter, ctx.userId);
    if (limited) return limited;
    const params = new URL(request.url).searchParams;
    const query = params.get("q") ?? "";
    const limit = params.has("limit") ? Number(params.get("limit")) : undefined;
    const results = await searchStudents(ctx.userId, query, limit);
    return socialJson({ results });
  } catch (error) {
    return handleSocialError(error);
  }
}
