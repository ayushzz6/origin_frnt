/**
 * Phase 14 (F.2): POST .../rooms/[roomId]/start — the teacher (room admin) starts
 * the configured room test, flipping the room to `in_test`. Reuses the legacy room
 * engine via `startTeacherRoomTest`, which resolves the room's teacher_test_id from
 * assessment.tests. Ships dark behind teacherConnect.
 *
 * Falls under the `/api/teacher` authenticated prefix in route-policy; membership
 * is enforced in-handler (owner/admin/teacher), and the engine re-checks that the
 * actor is the room admin participant.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { publishRoomEvent } from "@/server/rooms-pubsub";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { startTeacherRoomTest } from "@/server/workspaces/teacher-rooms-service";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

export async function POST(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; roomId: string }> },
) {
  try {
    requireFeatureEnabled("teacherConnect");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, ["owner", "admin", "teacher"]);
    const { roomId } = await context.params;

    const { room, event } = await startTeacherRoomTest({
      actorUserId: ctx.auth.userId,
      workspaceId,
      roomId,
      requestId: requestIdOf(request),
    });

    // Notify joined participants so their lobby advances to the test, mirroring
    // the student-room start route.
    await publishRoomEvent(roomId, { type: "test_started", ...event });

    return teacherJson({ room, event });
  } catch (error) {
    return handleTeacherError(error);
  }
}
