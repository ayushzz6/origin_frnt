/**
 * POST /api/admin/search
 * GET /api/admin/search
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { searchWorkspacesService, searchUsersService } from "@/server/workspaces/admin-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const SearchSchema = z.object({
  query: z.string().optional(),
  type: z.enum(["workspace", "user"]).optional(),
  workspaceType: z.enum(["personal", "institute"]).optional(),
  status: z.enum(["active", "suspended", "all"]).optional(),
  role: z.enum(["student", "teacher", "admin"]).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("adminControlCenter");
    const ctx = await requireRole(request, ["admin"]);
    const body = await parseJsonBody(request);
    const parsed = SearchSchema.safeParse(body);
    if (!parsed.success) return teacherJson({ error: parsed.error.message }, { status: 400 });
    if (parsed.data.type === "user") {
      const users = await searchUsersService(parsed.data.query ?? "", { role: parsed.data.role }, parsed.data.limit);
      return teacherJson(users);
    }
    const workspaces = await searchWorkspacesService(parsed.data.query ?? "", {
      workspaceType: parsed.data.workspaceType,
      status: parsed.data.status,
    }, parsed.data.limit);
    return teacherJson(workspaces);
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("adminControlCenter");
    await requireRole(request, ["admin"]);
    const url = new URL(request.url);
    const query = url.searchParams.get("query") ?? "";
    const type = url.searchParams.get("type") as "workspace" | "user" | null;
    const workspaceType = url.searchParams.get("workspaceType") as "personal" | "institute" | null;
    const status = url.searchParams.get("status") as "active" | "suspended" | "all" | null;
    const role = url.searchParams.get("role") as "student" | "teacher" | "admin" | null;
    const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined;
    if (type === "user") {
      const users = await searchUsersService(query, { role: role ?? undefined }, limit);
      return teacherJson(users);
    }
    const workspaces = await searchWorkspacesService(query, {
      workspaceType: workspaceType ?? undefined,
      status: status ?? undefined,
    }, limit);
    return teacherJson(workspaces);
  } catch (error) {
    return handleTeacherError(error);
  }
}
