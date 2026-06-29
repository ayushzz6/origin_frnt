import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { deleteSyllabusNode, updateSyllabusNode } from "@/server/workspaces/syllabus-store";

import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";

type Context = {
  params: Promise<{ workspaceId: string; batchId: string; nodeId: string }>;
};

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  manualStatus: z.enum(["mastered", "in_progress", "unstarted"]).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function PATCH(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("batchSyllabus");
    const { workspaceId, nodeId } = await context.params;
    const ctx = await requireWorkspaceMember(request, workspaceId, ["owner", "admin", "teacher"]);
    const body = await parseJsonBody(request);
    const patch = patchSchema.parse(body);
    const ok = await updateSyllabusNode(workspaceId, nodeId, patch);
    if (!ok) return teacherJson({ detail: "Syllabus node not found." }, { status: 404 });
    await recordAuditEvent({
      actorUserId: ctx.auth.userId,
      workspaceId,
      entityType: "batch",
      entityId: nodeId,
      action: "batch.syllabus_node_updated",
      after: patch,
      requestId: requestIdOf(request),
    });
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("batchSyllabus");
    const { workspaceId, nodeId } = await context.params;
    const ctx = await requireWorkspaceMember(request, workspaceId, ["owner", "admin", "teacher"]);
    const ok = await deleteSyllabusNode(workspaceId, nodeId);
    if (!ok) return teacherJson({ detail: "Syllabus node not found." }, { status: 404 });
    await recordAuditEvent({
      actorUserId: ctx.auth.userId,
      workspaceId,
      entityType: "batch",
      entityId: nodeId,
      action: "batch.syllabus_node_deleted",
      requestId: requestIdOf(request),
    });
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}
