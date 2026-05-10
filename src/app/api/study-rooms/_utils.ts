import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

import { resolveTokenToUser } from "@/server/auth";
import { getRoomParticipants, StudyRoomError } from "@/server/study-rooms";
import { publishRoomEvent } from "@/server/rooms-pubsub";

export type IdRouteContext = {
  params: Promise<{ id: string }>;
};

export async function requireStudyRoomUser(request: NextRequest) {
  const user = await resolveTokenToUser(request);
  if (!user) {
    throw new StudyRoomError(401, "Authentication credentials were not provided.");
  }
  return user;
}

export async function getRoomId(context: IdRouteContext): Promise<string> {
  const { id } = await context.params;
  return id;
}

export function studyRoomJson<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function handleStudyRoomError(error: unknown) {
  if (error instanceof StudyRoomError) {
    return studyRoomJson({ detail: error.message }, { status: error.status });
  }

  console.error("[study-rooms] request failed", error);
  return studyRoomJson({ detail: error instanceof Error ? error.message : "Study room request failed." }, { status: 500 });
}

export async function publishPresence(roomId: string): Promise<void> {
  const participants = await getRoomParticipants(roomId);
  await publishRoomEvent(roomId, { type: "presence", participants });
}

export function revalidateStudyRoomSurfaces(userId: string, roomId?: string): void {
  revalidateTag(`study-rooms-user:${userId}`, "max");
  revalidatePath("/study-rooms", "page");
  if (roomId) {
    revalidatePath(`/study-rooms/${roomId}/lobby`, "page");
    revalidatePath(`/study-rooms/${roomId}/leaderboard`, "page");
  }
}
