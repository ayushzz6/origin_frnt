import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { createBatch, listBatches } from "@/server/workspaces/batches";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  course: z.string().max(80).nullable().optional(),
  subject: z.string().max(80).nullable().optional(),
  classLevel: z.string().max(40).nullable().optional(),
  scheduleText: z.string().max(240).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  status: z.enum(["draft", "active", "completed", "archived"]).optional(),
});

export async function GET(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("batches");
    const workspaceId = await getWorkspaceId(context);
    await requireWorkspaceMember(request, workspaceId);
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const allowed = ["draft", "active", "completed", "archived", "all"] as const;
    const status = allowed.includes(rawStatus as (typeof allowed)[number])
      ? (rawStatus as (typeof allowed)[number])
      : undefined;
    const batches = await listBatches(workspaceId, { status: status === "all" ? "all" : status });
    return teacherJson({ batches });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("batches");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner",
      "admin",
      "teacher",
    ]);
    const body = await parseJsonBody(request);
    const parsed = createSchema.parse(body);
    const batch = await createBatch({
      workspaceId,
      createdBy: ctx.auth.userId,
      ...parsed,
    });
    await recordAuditEvent({
      actorUserId: ctx.auth.userId,
      workspaceId,
      entityType: "batch",
      entityId: batch.id,
      action: "batch.created",
      after: batch,
      requestId: requestIdOf(request),
    });
    return teacherJson({ batch }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
