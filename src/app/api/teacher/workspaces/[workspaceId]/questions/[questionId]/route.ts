import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { getQuestionWithVersion } from "@/server/workspaces/questions";
import {
  editTeacherQuestion,
  publishPrivateQuestion,
  submitToOgCode,
  archiveQuestion,
  markNeedsReview,
  getTeacherQuestion,
} from "@/server/workspaces/questions-service";
import { listVersions } from "@/server/workspaces/questions";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

const questionTypeEnum = z.enum([
  "mcq", "msq", "numerical", "numerical_with_units",
  "symbolic_expression", "equation", "matrix_match", "subjective",
]);
const difficultyEnum = z.enum(["easy", "medium", "hard", "insane"]);

const optionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

const editSchema = z.object({
  questionType: questionTypeEnum,
  stem: z.string().min(1),
  options: z.array(optionSchema).optional().nullable(),
  correctOption: z.number().int().min(0).optional().nullable(),
  correctOptions: z.array(z.number().int().min(0)).optional().nullable(),
  answerText: z.string().optional().nullable(),
  answerSpec: z.record(z.string(), z.unknown()).optional().nullable(),
  matrixData: z.record(z.string(), z.unknown()).optional().nullable(),
  hint: z.string().optional().nullable(),
  explanation: z.string().optional().nullable(),
  fullSolution: z.string().optional().nullable(),
  subject: z.string().min(1),
  chapter: z.string().min(1),
  concept: z.string().min(1),
  difficulty: difficultyEnum,
  tags: z.array(z.string()).optional().nullable(),
});

const submitOgCodeSchema = z.object({
  attributionName: z.string().min(1, "Attribution name is required"),
});

async function getQuestionContext(workspaceId: string, questionId: string) {
  const question = await getTeacherQuestion(workspaceId, questionId);
  if (!question) {
    throw new Error("Question not found or access denied.");
  }
  return question;
}

export async function GET(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; questionId: string }> },
) {
  try {
    requireFeatureEnabled("questionBag");
    const workspaceId = await getWorkspaceId(context);
    await requireWorkspaceMember(request, workspaceId);
    const { questionId } = await context.params;
    const question = await getQuestionContext(workspaceId, questionId);
    return teacherJson({ question });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; questionId: string }> },
) {
  try {
    requireFeatureEnabled("questionBag");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner", "admin", "teacher", "content_manager",
    ]);
    const { questionId } = await context.params;
    const body = await parseJsonBody(request);
    const parsed = editSchema.parse(body);

    const version = await editTeacherQuestion({
      actorUserId: ctx.auth.userId,
      workspaceId,
      questionId,
      questionType: parsed.questionType,
      stem: parsed.stem,
      options: parsed.options ?? null,
      correctOption: parsed.correctOption ?? null,
      correctOptions: parsed.correctOptions ?? null,
      answerText: parsed.answerText ?? null,
      answerSpec: parsed.answerSpec ?? null,
      matrixData: parsed.matrixData ?? null,
      hint: parsed.hint ?? null,
      explanation: parsed.explanation ?? null,
      fullSolution: parsed.fullSolution ?? null,
      subject: parsed.subject,
      chapter: parsed.chapter,
      concept: parsed.concept,
      difficulty: parsed.difficulty,
      tags: parsed.tags ?? [],
      requestId: requestIdOf(request),
    });

    return teacherJson({ version });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; questionId: string }> },
) {
  try {
    requireFeatureEnabled("questionBag");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner", "admin", "teacher",
    ]);
    const { questionId } = await context.params;

    const archived = await archiveQuestion({
      actorUserId: ctx.auth.userId,
      workspaceId,
      questionId,
      requestId: requestIdOf(request),
    });

    return teacherJson({ question: archived });
  } catch (error) {
    return handleTeacherError(error);
  }
}