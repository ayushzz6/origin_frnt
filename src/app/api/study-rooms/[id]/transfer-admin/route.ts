import type { NextRequest } from "next/server";

import { generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/server/http";
import { publishRoomEvent } from "@/server/rooms-pubsub";
import { transferAdmin } from "@/server/study-rooms";
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
    const body = await parseJsonBody<{ new_admin_user_id?: string }>(request);
    const newAdminUserId = body.new_admin_user_id ?? "";
    await transferAdmin(roomId, user.id, newAdminUserId);
    await publishRoomEvent(roomId, { type: "admin_changed", new_admin_user_id: newAdminUserId });
    await publishPresence(roomId);
    revalidateStudyRoomSurfaces(user.id, roomId);
    if (newAdminUserId) {
      revalidateStudyRoomSurfaces(newAdminUserId, roomId);
    }
    return studyRoomJson({ ok: true });
  } catch (error) {
    return handleStudyRoomError(error);
  }
}
