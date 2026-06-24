/**
 * GET /api/social/followers/[username]?page=0
 * Paginated list of students who follow [username]. Private profiles return
 * { hidden: true, items: [] } to non-owners.
 */

import type { NextRequest } from "next/server";

import { listFollowers } from "@/server/social/social-service";
import { requireSocialUser, socialJson, handleSocialError } from "@/app/api/social/_utils";

type RouteContext = { params: Promise<{ username: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireSocialUser(request);
    const { username } = await context.params;
    const page = Number(new URL(request.url).searchParams.get("page") ?? "0") || 0;
    return socialJson(await listFollowers(username, ctx.userId, page));
  } catch (error) {
    return handleSocialError(error);
  }
}
