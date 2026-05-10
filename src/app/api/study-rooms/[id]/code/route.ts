import type { NextRequest } from "next/server";

import { roomCodeLimiter, generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import { generateInviteCode, getCurrentInviteCode } from "@/server/study-rooms";
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
    return studyRoomJson({ invite_code: await getCurrentInviteCode(roomId, user.id) });
  } catch (error) {
    return handleStudyRoomError(error);
  }
}

export async function POST(request: NextRequest, context: IdRouteContext) {
  try {
    const user = await requireStudyRoomUser(request);
    const roomId = await getRoomId(context);
    const limited = await checkRateLimit(roomCodeLimiter, roomId);
    if (limited) return limited;
    return studyRoomJson({ invite_code: await generateInviteCode(roomId, user.id) });
  } catch (error) {
    return handleStudyRoomError(error);
  }
}
