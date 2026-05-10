import type { NextRequest } from "next/server";

import { generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import { publishRoomEvent } from "@/server/rooms-pubsub";
import { startRoomTest } from "@/server/study-rooms";
import {
  getRoomId,
  handleStudyRoomError,
  revalidateStudyRoomSurfaces,
  requireStudyRoomUser,
  studyRoomJson,
  type IdRouteContext,
} from "@/app/api/study-rooms/_utils";

export async function POST(request: NextRequest, context: IdRouteContext) {
  try {
    const user = await requireStudyRoomUser(request);
    const limited = await checkRateLimit(generalLimiter, user.id);
    if (limited) return limited;
    const roomId = await getRoomId(context);
    const event = await startRoomTest(roomId, user.id);
    await publishRoomEvent(roomId, { type: "test_started", ...event });
    revalidateStudyRoomSurfaces(user.id, roomId);
    return studyRoomJson(event);
  } catch (error) {
    return handleStudyRoomError(error);
  }
}
