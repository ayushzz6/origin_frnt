import type { NextRequest } from "next/server";

import { roomChatLimiter, generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/server/http";
import { publishRoomEvent } from "@/server/rooms-pubsub";
import { requireRoomMembership, sendRoomMessage } from "@/server/study-rooms";
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

/**
 * Typing indicator (WhatsApp-style). Folded onto the chat route as PUT so we
 * reuse a proven route file rather than add a brand-new nested route (see the
 * Next 16 new-route deploy note). The ping is ephemeral: it broadcasts a
 * `typing` event over the room stream and is never written to Postgres. The
 * client debounces these, so the membership check + publish stays cheap.
 */
export async function PUT(request: NextRequest, context: IdRouteContext) {
  try {
    const user = await requireStudyRoomUser(request);
    const limited = await checkRateLimit(generalLimiter, user.id);
    if (limited) return limited;
    const roomId = await getRoomId(context);
    const membership = await requireRoomMembership(roomId, user.id);
    const body = await parseJsonBody<{ is_typing?: boolean }>(request);
    await publishRoomEvent(roomId, {
      type: "typing",
      user_id: user.id,
      display_name: membership.display_name,
      is_typing: Boolean(body.is_typing),
    });
    return studyRoomJson({ ok: true });
  } catch (error) {
    return handleStudyRoomError(error);
  }
}
