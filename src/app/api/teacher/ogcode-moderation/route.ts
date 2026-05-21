import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { getModerationQueue } from "@/server/workspaces/ogcode-publishing-service";

import { handleTeacherError, teacherJson } from "../_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("ogcodePublishing");
    await requireRole(request, ["admin"]);
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const queue = await getModerationQueue(Math.min(limit, 100));
    return teacherJson({ queue });
  } catch (error) {
    return handleTeacherError(error);
  }
}
