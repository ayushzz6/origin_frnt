import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { requireWorkspaceMember, requireWorkspaceOwnerOrAdmin } from "@/server/workspaces/authz";
import { deleteBatch, getBatch, updateBatch } from "@/server/workspaces/batches";

import {
  handleTeacherError,
  requestIdOf,
  teacherJson,
} from "@/app/api/teacher/_utils";

type Context = {
  params: Promise<{ workspaceId: string; batchId: string }>;
};

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  course: z.string().max(80).nullable().optional(),
  subject: z.string().max(80).nullable().optional(),
  classLevel: z.string().max(40).nullable().optional(),
  scheduleText: z.string().max(240).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  status: z.enum(["draft", "active", "completed", "archived"]).optional(),
});

export async function GET(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("batches");
    const { workspaceId, batchId } = await context.params;
    await requireWorkspaceMember(request, workspaceId);
    const batch = await getBatch(workspaceId, batchId);
    if (!batch) return teacherJson({ detail: "Batch not found." }, { status: 404 });
    return teacherJson({ batch });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("batches");
    const { workspaceId, batchId } = await context.params;
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner",
      "admin",
      "teacher",
    ]);
    const body = await parseJsonBody(request);
    const patch = patchSchema.parse(body);
    const before = await getBatch(workspaceId, batchId);
    if (!before) return teacherJson({ detail: "Batch not found." }, { status: 404 });
    const updated = await updateBatch(workspaceId, batchId, patch);
    if (!updated) return teacherJson({ detail: "Batch update failed." }, { status: 400 });
    await recordAuditEvent({
      actorUserId: ctx.auth.userId,
      workspaceId,
      entityType: "batch",
      entityId: batchId,
      action: "batch.updated",
      before,
      after: updated,
      requestId: requestIdOf(request),
    });
    return teacherJson({ batch: updated });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("batches");
    const { workspaceId, batchId } = await context.params;
    const ctx = await requireWorkspaceOwnerOrAdmin(request, workspaceId);
    const before = await getBatch(workspaceId, batchId);
    if (!before) return teacherJson({ detail: "Batch not found." }, { status: 404 });
    const ok = await deleteBatch(workspaceId, batchId);
    if (!ok) return teacherJson({ detail: "Delete failed." }, { status: 400 });
    await recordAuditEvent({
      actorUserId: ctx.auth.userId,
      workspaceId,
      entityType: "batch",
      entityId: batchId,
      action: "batch.deleted",
      before,
      requestId: requestIdOf(request),
    });
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}
