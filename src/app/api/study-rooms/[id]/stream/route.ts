import type { NextRequest } from "next/server";

import { xreadRoomEvents } from "@/server/rooms-pubsub";
import { requireRoomMembership } from "@/server/study-rooms";
import {
  getRoomId,
  handleStudyRoomError,
  requireStudyRoomUser,
  type IdRouteContext,
} from "@/app/api/study-rooms/_utils";

export const maxDuration = 60;

function encodeSse(eventId: string, eventType: string, payload: unknown): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(`id: ${eventId}\nevent: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export async function GET(request: NextRequest, context: IdRouteContext) {
  try {
    const user = await requireStudyRoomUser(request);
    const roomId = await getRoomId(context);
    await requireRoomMembership(roomId, user.id);

    const initialCursor = request.headers.get("last-event-id") ?? "$";
    const signal = request.signal;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        let cursor = initialCursor;
        let lastMembershipCheck = Date.now();

        controller.enqueue(encoder.encode(": connected\n\n"));

        try {
          while (!signal.aborted) {
            const events = await xreadRoomEvents(roomId, cursor, {
              count: 50,
              blockMs: 20_000,
              signal,
            });

            const membershipCheckDue = Date.now() - lastMembershipCheck > 15_000;
            if (membershipCheckDue) {
              try {
                await requireRoomMembership(roomId, user.id);
                lastMembershipCheck = Date.now();
              } catch {
                controller.enqueue(encodeSse(cursor, "membership_lost", { type: "membership_lost" }));
                break;
              }
            }

            if (events.length === 0) {
              controller.enqueue(encoder.encode(": keepalive\n\n"));
              continue;
            }

            for (const entry of events) {
              controller.enqueue(encodeSse(entry.id, entry.event.type, entry.event));
              cursor = entry.id;
              if (
                (entry.event.type === "kicked" && entry.event.user_id === user.id) ||
                entry.event.type === "room_closed"
              ) {
                return;
              }
            }
          }
        } catch (error) {
          if (!signal.aborted) {
            controller.error(error);
          }
        } finally {
          try {
            controller.close();
          } catch {
            // Already closed by the client.
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return handleStudyRoomError(error);
  }
}
