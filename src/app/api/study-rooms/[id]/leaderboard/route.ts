import type { NextRequest } from "next/server";

import { generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import { getRoomDppPlans, getRoomLeaderboard } from "@/server/study-rooms";
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
    const [leaderboard, dpps] = await Promise.all([
      getRoomLeaderboard(roomId, user.id),
      getRoomDppPlans(roomId, user.id),
    ]);
    return studyRoomJson({ leaderboard, dpps });
  } catch (error) {
    return handleStudyRoomError(error);
  }
}
