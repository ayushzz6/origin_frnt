import type { NextRequest } from "next/server";

import { roomCreateLimiter, generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/server/http";
import { createRoom, generateInviteCode, listRoomsForUser } from "@/server/study-rooms";
import {
  handleStudyRoomError,
  publishPresence,
  revalidateStudyRoomSurfaces,
  requireStudyRoomUser,
  studyRoomJson,
} from "@/app/api/study-rooms/_utils";

export async function GET(request: NextRequest) {
  try {
    const user = await requireStudyRoomUser(request);
    const limited = await checkRateLimit(generalLimiter, user.id);
    if (limited) return limited;
    return studyRoomJson({ rooms: await listRoomsForUser(user.id) });
  } catch (error) {
    return handleStudyRoomError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireStudyRoomUser(request);
    const limited = await checkRateLimit(roomCreateLimiter, user.id);
    if (limited) return limited;

    const body = await parseJsonBody<{ name?: string }>(request);
    const room = await createRoom(user, body.name ?? "Study Room");
    const invite_code = await generateInviteCode(room.id, user.id);
    await publishPresence(room.id);
    revalidateStudyRoomSurfaces(user.id, room.id);
    return studyRoomJson({ room, invite_code }, { status: 201 });
  } catch (error) {
    return handleStudyRoomError(error);
  }
}
