import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import {
  createTeacherQuestion,
  listTeacherQuestions,
  type CreateQuestionInputFull,
} from "@/server/workspaces/questions-service";

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

const createSchema = z.object({
  questionType: questionTypeEnum,
  stem: z.string().min(1, "Stem is required"),
  options: z.array(optionSchema).optional().nullable(),
  correctOption: z.number().int().min(0).optional().nullable(),
  correctOptions: z.array(z.number().int().min(0)).optional().nullable(),
  answerText: z.string().optional().nullable(),
  answerSpec: z.record(z.string(), z.unknown()).optional().nullable(),
  matrixData: z.record(z.string(), z.unknown()).optional().nullable(),
  hint: z.string().optional().nullable(),
  explanation: z.string().optional().nullable(),
  fullSolution: z.string().optional().nullable(),
  subject: z.string().min(1, "Subject is required"),
  chapter: z.string().min(1, "Chapter is required"),
  concept: z.string().min(1, "Concept/topic is required"),
  difficulty: difficultyEnum,
  tags: z.array(z.string()).optional().nullable(),
});

export async function GET(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("questionBag");
    const workspaceId = await getWorkspaceId(context);
    await requireWorkspaceMember(request, workspaceId);
    const url = new URL(request.url);
    const filter = {
      status: url.searchParams.get("status") ?? undefined,
      subject: url.searchParams.get("subject") ?? undefined,
      chapter: url.searchParams.get("chapter") ?? undefined,
      difficulty: url.searchParams.get("difficulty") ?? undefined,
      questionType: url.searchParams.get("questionType") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
    };
    const questions = await listTeacherQuestions(workspaceId, {
      status: filter.status as never,
      subject: filter.subject,
      chapter: filter.chapter,
      difficulty: filter.difficulty as never,
      questionType: filter.questionType as never,
      search: filter.search,
    });
    return teacherJson({ questions });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("questionBag");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner", "admin", "teacher", "content_manager",
    ]);
    const body = await parseJsonBody(request);
    const parsed = createSchema.parse(body);

    const input: CreateQuestionInputFull = {
      workspaceId,
      actorUserId: ctx.auth.userId,
      createdBy: ctx.auth.userId,
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
    };

    const question = await createTeacherQuestion(input);
    return teacherJson({ question }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}