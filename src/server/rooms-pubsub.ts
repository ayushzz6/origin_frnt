import type { RoomEvent } from "@/lib/study-rooms/events";
import { appendRoomStreamEvent, deleteRoomStream, readRoomStreamEvents } from "@/server/rooms-redis";

export async function publishRoomEvent(roomId: string, event: RoomEvent): Promise<void> {
  await appendRoomStreamEvent(roomId, event);
}

export async function xreadRoomEvents(
  roomId: string,
  cursor: string,
  options: { count?: number; blockMs?: number; signal?: AbortSignal } = {},
) {
  return readRoomStreamEvents(roomId, cursor, options);
}

export async function clearRoomEvents(roomId: string): Promise<void> {
  await deleteRoomStream(roomId);
}
