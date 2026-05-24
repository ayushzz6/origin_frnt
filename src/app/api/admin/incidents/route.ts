/**
 * GET /api/admin/incidents — current incident state (admin-only).
 */

import type { NextRequest } from "next/server";

import { requireRole } from "@/server/authz";
import { getIncidentSnapshot } from "@/server/incidents";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, ["admin"]);
    const snapshot = await getIncidentSnapshot();
    return teacherJson({ incidents: snapshot });
  } catch (error) {
    return handleTeacherError(error);
  }
}
