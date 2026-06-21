import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import {
  getTeacherTest,
  updateTeacherTest,
  publishTeacherTest,
  scheduleTeacherTest,
  closeTeacherTest,
  deleteTeacherTest,
} from "@/server/workspaces/tests-service";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

const questionInputSchema = z.object({
  position: z.number().int().min(1),
  sourceBank: z.enum(["ogcode", "workspace_bag", "platform_content"]),
  ogcodeQuestionId: z.string().nullish(),
  contentQuestionId: z.string().nullish(),
  contentQuestionVersionId: z.string().nullish(),
  marks: z.number().optional().default(4),
  negativeMarks: z.number().optional().default(-1),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  subject: z.string().optional(),
  chapter: z.string().optional().nullable(),
  difficulty: z.string().optional(),
  durationMinutes: z.number().int().min(1).max(300).optional(),
  selectionPolicy: z.record(z.string(), z.unknown()).optional(),
  scoringPolicy: z.record(z.string(), z.unknown()).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  // When present, replaces the test's questions (mixed OG Code + Question Bag).
  questions: z.array(questionInputSchema).optional(),
});

const scheduleSchema = z.object({
  scheduledStartAt: z.string().datetime(),
  scheduledEndAt: z.string().datetime(),
});

async function loadTest(workspaceId: string, testId: string) {
  const test = await getTeacherTest(workspaceId, testId);
  if (!test) {
    throw new Error("Test not found or access denied.");
  }
  return test;
}

export async function GET(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; testId: string }> },
) {
  try {
    requireFeatureEnabled("teacherTests");
    const workspaceId = await getWorkspaceId(context);
    await requireWorkspaceMember(request, workspaceId);
    const { testId } = await context.params;
    const test = await loadTest(workspaceId, testId);
    return teacherJson({ test });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; testId: string }> },
) {
  try {
    requireFeatureEnabled("teacherTests");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner", "admin", "teacher",
    ]);
    const { testId } = await context.params;
    const body = await parseJsonBody(request);
    const { questions, ...rest } = updateSchema.parse(body);

    const updated = await updateTeacherTest({
      actorUserId: ctx.auth.userId,
      workspaceId,
      testId,
      patch: rest,
      questions,
      requestId: requestIdOf(request),
    });

    return teacherJson({ test: updated });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; testId: string }> },
) {
  try {
    requireFeatureEnabled("teacherTests");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner", "admin", "teacher",
    ]);
    const { testId } = await context.params;
    await deleteTeacherTest({
      actorUserId: ctx.auth.userId,
      workspaceId,
      testId,
      requestId: requestIdOf(request),
    });
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}