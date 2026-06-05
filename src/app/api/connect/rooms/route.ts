/**
 * GET /api/connect/rooms — live teacher rooms the student may join via batch
 * membership. Surfaced in /connect → "My institutes". Gated by teacherConnect;
 * student-only. Falls under the `/api/connect` authenticated prefix in route-policy.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { listJoinableConnectRooms } from "@/server/connect/connect-rooms-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("teacherConnect");
    const auth = await requireRole(request, ["student"]);
    const rooms = await listJoinableConnectRooms(auth.userId);
    return teacherJson({ rooms });
  } catch (error) {
    return handleTeacherError(error);
  }
}
