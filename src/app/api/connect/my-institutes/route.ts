/**
 * GET /api/connect/my-institutes — the institutes the student is connected to.
 *
 * Every workspace the student has a live enrollment in, with their batches and
 * unlocked subjects per institute. Powers the "My institutes" tab so a connected
 * student can see which institutes they belong to (the teacher-side already shows
 * the student; this closes the student-side gap). Gated by teacherConnect;
 * student-only.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { listStudentInstitutes } from "@/server/connect/connect-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("teacherConnect");
    const ctx = await requireRole(request, ["student"]);
    const institutes = await listStudentInstitutes(ctx.userId);
    return teacherJson({ institutes });
  } catch (error) {
    return handleTeacherError(error);
  }
}
