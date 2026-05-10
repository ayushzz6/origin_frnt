import type { NextRequest } from "next/server";

import { generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import { clearRoomEvents, publishRoomEvent } from "@/server/rooms-pubsub";
import { deleteRoom, getRoomState } from "@/server/study-rooms";
import {
  getRoomId,
  handleStudyRoomError,
  revalidateStudyRoomSurfaces,
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
    return studyRoomJson(await getRoomState(roomId, user.id));
  } catch (error) {
    return handleStudyRoomError(error);
  }
}

export async function DELETE(request: NextRequest, context: IdRouteContext) {
  try {
    const user = await requireStudyRoomUser(request);
    const limited = await checkRateLimit(generalLimiter, user.id);
    if (limited) return limited;
    const roomId = await getRoomId(context);
    const room = await deleteRoom(roomId, user.id);
    await publishRoomEvent(roomId, { type: "room_closed" });
    await clearRoomEvents(roomId);
    revalidateStudyRoomSurfaces(user.id, roomId);
    return studyRoomJson({ room, deleted: true });
  } catch (error) {
    return handleStudyRoomError(error);
  }
}
