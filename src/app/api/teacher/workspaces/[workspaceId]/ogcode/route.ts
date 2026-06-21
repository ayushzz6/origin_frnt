/**
 * GET /api/teacher/workspaces/[workspaceId]/ogcode — teacher OG Code bank browse.
 *
 * Reuses the ungated catalog (full bank — teachers are not premium-gated). Two modes:
 *   • default          → paginated question page (filters + excludeIds for cart de-dup)
 *   • ?meta=chapters    → distinct chapters for a subject (filter dropdown)
 * Gated by `teacherOgcode`; authenticated `/api/teacher/*` prefix (no route-policy change).
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import {
  listOgcodeBrowseChapters,
  listOgcodeBrowsePage,
} from "@/server/workspaces/ogcode-browse-service";

import {
  getWorkspaceId,
  handleTeacherError,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("teacherOgcode");
    const workspaceId = await getWorkspaceId(context);
    await requireWorkspaceMember(request, workspaceId, [
      "owner",
      "admin",
      "teacher",
      "content_manager",
    ]);

    const url = new URL(request.url);

    if (url.searchParams.get("meta") === "chapters") {
      const chapters = await listOgcodeBrowseChapters(url.searchParams.get("subject") ?? "");
      return teacherJson({ chapters });
    }

    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 30, 1), 50);
    const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
    const chapters = url.searchParams.getAll("chapters").filter(Boolean);
    const excludeIds = (url.searchParams.get("excludeIds") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const page = await listOgcodeBrowsePage({
      subject: url.searchParams.get("subject"),
      difficulty: url.searchParams.get("difficulty"),
      type: url.searchParams.get("type"),
      search: url.searchParams.get("search"),
      chapters: chapters.length ? chapters : null,
      excludeIds: excludeIds.length ? excludeIds : null,
      limit,
      offset,
    });
    return teacherJson(page);
  } catch (error) {
    return handleTeacherError(error);
  }
}
