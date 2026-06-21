import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import {
  createTeacherTest,
  listTeacherTests,
  type CreateTeacherTestInput,
} from "@/server/workspaces/tests-service";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

const questionSourceBankEnum = z.enum(["ogcode", "workspace_bag", "platform_content"]);

const questionInputSchema = z.object({
  position: z.number().int().min(1),
  sourceBank: questionSourceBankEnum,
  // The builder sends the inactive source's id as `null` (ogcode rows carry
  // ogcodeQuestionId, workspace_bag rows carry contentQuestionId). Accept null
  // as well as omitted; the service enforces the right id per source bank.
  ogcodeQuestionId: z.string().nullish(),
  contentQuestionId: z.string().nullish(),
  contentQuestionVersionId: z.string().nullish(),
  marks: z.number().optional().default(4),
  negativeMarks: z.number().optional().default(-1),
});

const createTestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  subject: z.string().optional().default("mixed"),
  chapter: z.string().optional(),
  difficulty: z.string().optional().default("medium"),
  durationMinutes: z.number().int().min(1).max(300),
  questions: z.array(questionInputSchema).min(1, "At least one question is required."),
  selectionPolicy: z.record(z.string(), z.unknown()).optional(),
  scoringPolicy: z.record(z.string(), z.unknown()).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("teacherTests");
    const workspaceId = await getWorkspaceId(context);
    await requireWorkspaceMember(request, workspaceId);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    const tests = await listTeacherTests(workspaceId, { status });
    return teacherJson({ tests });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("teacherTests");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner", "admin", "teacher",
    ]);
    const body = await parseJsonBody(request);
    const parsed = createTestSchema.parse(body);

    const input: CreateTeacherTestInput = {
      workspaceId,
      actorUserId: ctx.auth.userId,
      createdBy: ctx.auth.userId,
      title: parsed.title,
      description: parsed.description ?? null,
      subject: parsed.subject,
      chapter: parsed.chapter ?? null,
      difficulty: parsed.difficulty,
      durationMinutes: parsed.durationMinutes,
      questions: parsed.questions,
      selectionPolicy: parsed.selectionPolicy ?? {},
      scoringPolicy: parsed.scoringPolicy ?? {},
      settings: parsed.settings ?? {},
      requestId: requestIdOf(request),
    };

    const test = await createTeacherTest(input);
    return teacherJson({ test }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}