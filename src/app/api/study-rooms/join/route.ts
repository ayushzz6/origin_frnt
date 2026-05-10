import type { NextRequest } from "next/server";

import { roomJoinLimiter, checkRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/server/http";
import { joinRoomByCode } from "@/server/study-rooms";
import {
  handleStudyRoomError,
  publishPresence,
  revalidateStudyRoomSurfaces,
  requireStudyRoomUser,
  studyRoomJson,
} from "@/app/api/study-rooms/_utils";

export async function POST(request: NextRequest) {
  try {
    const user = await requireStudyRoomUser(request);
    const limited = await checkRateLimit(roomJoinLimiter, user.id);
    if (limited) return limited;

    const body = await parseJsonBody<{ code?: string }>(request);
    const room = await joinRoomByCode(body.code ?? "", user);
    await publishPresence(room.id);
    revalidateStudyRoomSurfaces(user.id, room.id);
    return studyRoomJson({ roomId: room.id, room });
  } catch (error) {
    return handleStudyRoomError(error);
  }
}
