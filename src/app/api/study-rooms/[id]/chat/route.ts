import type { NextRequest } from "next/server";

import { roomChatLimiter, checkRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/server/http";
import { publishRoomEvent } from "@/server/rooms-pubsub";
import { sendRoomMessage } from "@/server/study-rooms";
import {
  getRoomId,
  handleStudyRoomError,
  requireStudyRoomUser,
  studyRoomJson,
  type IdRouteContext,
} from "@/app/api/study-rooms/_utils";

export async function POST(request: NextRequest, context: IdRouteContext) {
  try {
    const user = await requireStudyRoomUser(request);
    const limited = await checkRateLimit(roomChatLimiter, user.id);
    if (limited) return limited;
    const roomId = await getRoomId(context);
    const body = await parseJsonBody<{ content?: string }>(request);
    const message = await sendRoomMessage(roomId, user, body.content ?? "");
    await publishRoomEvent(roomId, { type: "chat", message });
    return studyRoomJson({ message }, { status: 201 });
  } catch (error) {
    return handleStudyRoomError(error);
  }
}
