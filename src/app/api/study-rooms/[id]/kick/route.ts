import type { NextRequest } from "next/server";

import { generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/server/http";
import { publishRoomEvent } from "@/server/rooms-pubsub";
import { kickParticipant } from "@/server/study-rooms";
import {
  getRoomId,
  handleStudyRoomError,
  publishPresence,
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
    const body = await parseJsonBody<{ user_id?: string }>(request);
    const targetUserId = body.user_id ?? "";
    await kickParticipant(roomId, user.id, targetUserId);
    await publishRoomEvent(roomId, { type: "kicked", user_id: targetUserId });
    await publishPresence(roomId);
    revalidateStudyRoomSurfaces(user.id, roomId);
    if (targetUserId) {
      revalidateStudyRoomSurfaces(targetUserId, roomId);
    }
    return studyRoomJson({ ok: true });
  } catch (error) {
    return handleStudyRoomError(error);
  }
}
