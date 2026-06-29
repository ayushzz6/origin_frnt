import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { getBatch } from "@/server/workspaces/batches";
import { createSyllabusNode, getSyllabusTree } from "@/server/workspaces/syllabus-store";

import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";

type Context = {
  params: Promise<{ workspaceId: string; batchId: string }>;
};

const createSchema = z.object({
  kind: z.enum(["chapter", "topic"]),
  title: z.string().min(1).max(200),
  parentId: z.string().nullable().optional(),
  subject: z.string().max(80).nullable().optional(),
});

export async function GET(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("batchSyllabus");
    const { workspaceId, batchId } = await context.params;
    await requireWorkspaceMember(request, workspaceId);
    const batch = await getBatch(workspaceId, batchId);
    const tree = await getSyllabusTree(workspaceId, batchId, batch?.subject ?? null);
    return teacherJson({ tree });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("batchSyllabus");
    const { workspaceId, batchId } = await context.params;
    const ctx = await requireWorkspaceMember(request, workspaceId, ["owner", "admin", "teacher"]);
    const body = await parseJsonBody(request);
    const input = createSchema.parse(body);
    if (input.kind === "topic" && !input.parentId) {
      return teacherJson({ detail: "A topic needs a parent chapter." }, { status: 400 });
    }
    const node = await createSyllabusNode({
      workspaceId,
      batchId,
      kind: input.kind,
      title: input.title,
      parentId: input.parentId ?? null,
      subject: input.subject ?? null,
      createdBy: ctx.auth.userId,
    });
    await recordAuditEvent({
      actorUserId: ctx.auth.userId,
      workspaceId,
      entityType: "batch",
      entityId: batchId,
      action: "batch.syllabus_node_created",
      after: { id: node.id, kind: input.kind, title: input.title },
      requestId: requestIdOf(request),
    });
    return teacherJson({ node }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
