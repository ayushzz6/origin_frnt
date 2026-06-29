import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { createBatchMessage, listBatchMessages } from "@/server/workspaces/batch-messages-store";

import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";

type Context = {
  params: Promise<{ workspaceId: string; batchId: string }>;
};

const sendSchema = z.object({
  body: z.string().min(1).max(4000),
  linkUrl: z.string().url().max(2000).nullable().optional(),
});

export async function GET(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("batchHub");
    const { workspaceId, batchId } = await context.params;
    await requireWorkspaceMember(request, workspaceId);
    const messages = await listBatchMessages(workspaceId, batchId, { limit: 150 });
    return teacherJson({ messages });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("batchHub");
    const { workspaceId, batchId } = await context.params;
    const ctx = await requireWorkspaceMember(request, workspaceId, ["owner", "admin", "teacher"]);
    const body = await parseJsonBody(request);
    const input = sendSchema.parse(body);
    const message = await createBatchMessage({
      workspaceId,
      batchId,
      senderId: ctx.auth.userId,
      senderRole: "teacher",
      body: input.body,
      kind: input.linkUrl ? "link" : "text",
      linkUrl: input.linkUrl ?? null,
    });
    await recordAuditEvent({
      actorUserId: ctx.auth.userId,
      workspaceId,
      entityType: "batch",
      entityId: batchId,
      action: "batch.message_sent",
      after: { id: message.id, kind: message.kind },
      requestId: requestIdOf(request),
    });
    return teacherJson({ message }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
