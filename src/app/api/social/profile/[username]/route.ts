/**
 * GET /api/social/profile/[username]
 * Public profile snapshot for a student handle, viewed by the signed-in student.
 * Private profiles return the card with visible:false / stats:null unless the
 * viewer is the owner. 404 when no student owns the handle.
 */

import type { NextRequest } from "next/server";

import { getPublicProfile } from "@/server/social/social-service";
import { requireSocialUser, socialJson, handleSocialError, SocialError } from "@/app/api/social/_utils";

type RouteContext = { params: Promise<{ username: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireSocialUser(request);
    const { username } = await context.params;
    const profile = await getPublicProfile(ctx.userId, username);
    if (!profile) throw new SocialError(404, "Profile not found.");
    return socialJson(profile);
  } catch (error) {
    return handleSocialError(error);
  }
}
