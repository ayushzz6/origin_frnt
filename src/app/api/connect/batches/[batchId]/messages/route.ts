/**
 * Student-side batch message feed (Batch Hub). GET reads, POST sends — both
 * gated to students who are ACTIVE members of the batch (tenancy: a student can
 * only see/post in batches they belong to). Authenticated /api/connect prefix.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import {
  createBatchMessage,
  getStudentBatchContext,
  listBatchMessages,
} from "@/server/workspaces/batch-messages-store";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

type Context = {
  params: Promise<{ batchId: string }>;
};

const sendSchema = z.object({
  body: z.string().min(1).max(4000),
  linkUrl: z.string().url().max(2000).nullable().optional(),
});

export async function GET(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("teacherConnect");
    requireFeatureEnabled("batchHub");
    const { batchId } = await context.params;
    const ctx = await requireRole(request, ["student"]);
    const batch = await getStudentBatchContext(batchId, ctx.userId);
    if (!batch) {
      return teacherJson({ detail: "You are not a member of this batch." }, { status: 403 });
    }
    const messages = await listBatchMessages(batch.workspaceId, batchId, { limit: 150 });
    return teacherJson({ messages, batch: { name: batch.batchName, subject: batch.subject } });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("teacherConnect");
    requireFeatureEnabled("batchHub");
    const { batchId } = await context.params;
    const ctx = await requireRole(request, ["student"]);
    const batch = await getStudentBatchContext(batchId, ctx.userId);
    if (!batch) {
      return teacherJson({ detail: "You are not a member of this batch." }, { status: 403 });
    }
    const body = await parseJsonBody(request);
    const input = sendSchema.parse(body);
    const message = await createBatchMessage({
      workspaceId: batch.workspaceId,
      batchId,
      senderId: ctx.userId,
      senderRole: "student",
      body: input.body,
      kind: input.linkUrl ? "link" : "text",
      linkUrl: input.linkUrl ?? null,
    });
    return teacherJson({ message }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
