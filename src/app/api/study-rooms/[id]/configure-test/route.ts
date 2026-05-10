import type { NextRequest } from "next/server";

import { generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/server/http";
import { publishRoomEvent } from "@/server/rooms-pubsub";
import type { CustomTestPayload } from "@/server/assessments";
import { createCustomTestForRoom } from "@/server/study-rooms";
import { withStoreAsync } from "@/server/store";
import {
  getRoomId,
  handleStudyRoomError,
  revalidateStudyRoomSurfaces,
  requireStudyRoomUser,
  studyRoomJson,
  type IdRouteContext,
} from "@/app/api/study-rooms/_utils";

export const maxDuration = 300;

export async function POST(request: NextRequest, context: IdRouteContext) {
  try {
    const user = await requireStudyRoomUser(request);
    const limited = await checkRateLimit(generalLimiter, user.id);
    if (limited) return limited;
    const roomId = await getRoomId(context);
    const body = await parseJsonBody<CustomTestPayload>(request);
    const test = await withStoreAsync((store) => createCustomTestForRoom(store, user, roomId, body));
    await publishRoomEvent(roomId, { type: "test_configured", custom_test_id: (test as { id: string }).id });
    revalidateStudyRoomSurfaces(user.id, roomId);
    return studyRoomJson({ test }, { status: 201 });
  } catch (error) {
    return handleStudyRoomError(error);
  }
}
