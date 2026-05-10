import type { NextRequest } from "next/server";

import { generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import { getRoomMessages, requireRoomMembership } from "@/server/study-rooms";
import {
  getRoomId,
  handleStudyRoomError,
  requireStudyRoomUser,
  studyRoomJson,
  type IdRouteContext,
} from "@/app/api/study-rooms/_utils";

export async function GET(request: NextRequest, context: IdRouteContext) {
  try {
    const user = await requireStudyRoomUser(request);
    const limited = await checkRateLimit(generalLimiter, user.id);
    if (limited) return limited;
    const roomId = await getRoomId(context);
    await requireRoomMembership(roomId, user.id);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    return studyRoomJson({ messages: await getRoomMessages(roomId, limit) });
  } catch (error) {
    return handleStudyRoomError(error);
  }
}
