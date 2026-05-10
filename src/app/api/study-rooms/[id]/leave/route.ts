import type { NextRequest } from "next/server";

import { generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import { leaveRoom } from "@/server/study-rooms";
import {
  getRoomId,
  handleStudyRoomError,
  publishPresence,
  revalidateStudyRoomSurfaces,
  requireStudyRoomUser,
  studyRoomJson,
  type IdRouteContext,
} from "@/app/api/study-rooms/_utils";
import { publishRoomEvent } from "@/server/rooms-pubsub";

export async function POST(request: NextRequest, context: IdRouteContext) {
  try {
    const user = await requireStudyRoomUser(request);
    const limited = await checkRateLimit(generalLimiter, user.id);
    if (limited) return limited;
    const roomId = await getRoomId(context);
    const result = await leaveRoom(roomId, user.id);
    revalidateStudyRoomSurfaces(user.id, roomId);
    if (result.new_admin_user_id) {
      await publishRoomEvent(roomId, { type: "admin_changed", new_admin_user_id: result.new_admin_user_id });
      revalidateStudyRoomSurfaces(result.new_admin_user_id, roomId);
    }
    await publishPresence(roomId);
    if (result.room.status === "closed") {
      await publishRoomEvent(roomId, { type: "room_closed" });
    }
    return studyRoomJson(result);
  } catch (error) {
    return handleStudyRoomError(error);
  }
}
