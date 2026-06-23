import type { NextRequest } from "next/server";

import { generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/server/http";
import { clearRoomEvents, publishRoomEvent } from "@/server/rooms-pubsub";
import { deleteRoom, getRoomState, recordRoomHeartbeat } from "@/server/study-rooms";
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

/**
 * Presence heartbeat (Teacher Live Rooms). Folded onto the room route as POST
 * to reuse this proven route file rather than add a brand-new nested route
 * (Next 16 new-route deploy note). Both the lobby and the test-taking client
 * ping this ~every 15s; `on_test: true` stamps `entered_test_at` so the teacher
 * can tell who is actually giving the test from who is just in the room.
 */
export async function POST(request: NextRequest, context: IdRouteContext) {
  try {
    const user = await requireStudyRoomUser(request);
    const limited = await checkRateLimit(generalLimiter, user.id);
    if (limited) return limited;
    const roomId = await getRoomId(context);
    const body = await parseJsonBody<{ on_test?: boolean }>(request);
    const ok = await recordRoomHeartbeat(roomId, user.id, { onTest: Boolean(body.on_test) });
    return studyRoomJson({ ok });
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
