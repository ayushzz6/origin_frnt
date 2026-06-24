/**
 * POST   /api/social/follow   — follow the student in body { username }
 * DELETE /api/social/follow   — unfollow the student in body { username }
 * Idempotent; self-follow is rejected. Returns { following, followerCount }.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { mutationLimiter, checkRateLimit } from "@/lib/rate-limit";
import { followUser, unfollowUser } from "@/server/social/social-service";
import { requireSocialUser, socialJson, handleSocialError, SocialError } from "@/app/api/social/_utils";

const BodySchema = z.object({ username: z.string().trim().min(1).max(60) });

async function readUsername(request: NextRequest): Promise<string> {
  const body = await parseJsonBody(request);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) throw new SocialError(400, "A target username is required.");
  return parsed.data.username;
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireSocialUser(request);
    const limited = await checkRateLimit(mutationLimiter, ctx.userId);
    if (limited) return limited;
    const username = await readUsername(request);
    return socialJson(await followUser(ctx.userId, username));
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await requireSocialUser(request);
    const limited = await checkRateLimit(mutationLimiter, ctx.userId);
    if (limited) return limited;
    const username = await readUsername(request);
    return socialJson(await unfollowUser(ctx.userId, username));
  } catch (error) {
    return handleSocialError(error);
  }
}
