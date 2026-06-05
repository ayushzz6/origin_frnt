/**
 * POST /api/connect/rooms/[roomId]/join — membership-gated join (F.3). A student
 * who is an active member of a teacher_room's batch joins directly, without a
 * 6-char invite code. Gated by teacherConnect; student-only. Falls under the
 * `/api/connect` authenticated prefix in route-policy.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { getAuthenticatedUser, requireRole, AuthzError } from "@/server/authz";
import { joinConnectRoomByMembership } from "@/server/connect/connect-rooms-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  try {
    requireFeatureEnabled("teacherConnect");
    await requireRole(request, ["student"]);
    const user = await getAuthenticatedUser(request);
    if (!user) throw new AuthzError(401, "Authentication credentials were not provided.");
    const { roomId } = await context.params;

    const room = await joinConnectRoomByMembership(roomId, user);
    return teacherJson({ roomId: room.id, room });
  } catch (error) {
    return handleTeacherError(error);
  }
}
