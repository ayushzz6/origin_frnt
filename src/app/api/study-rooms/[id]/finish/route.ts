import type { NextRequest } from "next/server";

import { generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/server/http";
import { publishRoomEvent } from "@/server/rooms-pubsub";
import { finishRoomParticipant } from "@/server/study-rooms";
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
    const limited = await checkRateLimit(generalLimiter, user.id);
    if (limited) return limited;
    const roomId = await getRoomId(context);
    const body = await parseJsonBody<{
      test_result_id?: string | null;
      score?: number | null;
      time_taken_seconds?: number | null;
      auto_submitted?: boolean;
    }>(request);
    const result = await finishRoomParticipant(roomId, user.id, {
      testResultId: body.test_result_id ?? null,
      score: body.score ?? null,
      timeTakenSeconds: body.time_taken_seconds ?? null,
      autoSubmitted: body.auto_submitted ?? false,
    });
    await publishRoomEvent(roomId, { type: "participant_finished", user_id: user.id, rank: result.rank });
    if (result.ended_at) {
      await publishRoomEvent(roomId, { type: "test_ended", ended_at: result.ended_at });
    }
    return studyRoomJson(result);
  } catch (error) {
    return handleStudyRoomError(error);
  }
}
