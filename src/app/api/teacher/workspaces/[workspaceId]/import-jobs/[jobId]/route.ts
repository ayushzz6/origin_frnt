import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import {
  applyImportSubject,
  bulkAcceptReviewQuestions,
  cancelJob,
  createDraftTestFromImportJob,
  getJobPages,
  getJobQuestions,
  getJobWithProgress,
  reviewQuestion,
  updateImportQuestion,
} from "@/server/workspaces/document-import-service";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "../../../../_utils";

const reviewQuestionSchema = z.object({
  action: z.enum(["accept", "reject"]),
  rejectionReason: z.string().max(500).nullable().optional(),
});

const bulkAcceptSchema = z.object({
  questionIds: z.array(z.string()),
});

const updateQuestionSchema = z.object({
  questionId: z.string(),
  subject: z.string().max(80).nullable().optional(),
  chapter: z.string().max(120).nullable().optional(),
  concept: z.string().max(160).nullable().optional(),
  difficulty: z.enum(["easy", "medium", "hard", "insane"]).nullable().optional(),
  questionText: z.string().nullable().optional(),
  options: z.record(z.string(), z.unknown()).nullable().optional(),
  correctOption: z.number().int().nullable().optional(),
  answerText: z.string().nullable().optional(),
});

const applySubjectSchema = z.object({ subject: z.string().min(1).max(80) });

export async function GET(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; jobId: string }> },
) {
  try {
    requireFeatureEnabled("documentImport");
    const { workspaceId, jobId } = await context.params;
    await requireWorkspaceMember(request, workspaceId);
    const url = new URL(request.url);
    const type = url.searchParams.get("type");

    if (type === "pages") {
      const pages = await getJobPages(jobId);
      return teacherJson({ pages });
    }

    if (type === "questions") {
      const rawStatus = url.searchParams.get("status");
      const allowed = ["draft", "review_required", "accepted", "rejected", "published", "all"] as const;
      const status = rawStatus && allowed.includes(rawStatus as (typeof allowed)[number])
        ? (rawStatus as (typeof allowed)[number])
        : undefined;
      const limit = parseInt(url.searchParams.get("limit") ?? "100", 10);
      const questions = await getJobQuestions(jobId, {
        status: status === "all" ? "all" : status,
        limit: Math.min(limit, 200),
      });
      return teacherJson({ questions });
    }

    const job = await getJobWithProgress(workspaceId, jobId);
    if (!job) {
      return teacherJson({ detail: "Import job not found." }, { status: 404 });
    }
    return teacherJson({ job });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; jobId: string }> },
) {
  try {
    requireFeatureEnabled("documentImport");
    const { workspaceId, jobId } = await context.params;
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const body = await parseJsonBody(request);

    switch (action) {
      case "cancel": {
        const ctx = await requireWorkspaceMember(request, workspaceId, ["owner", "admin", "teacher"]);
        const cancelled = await cancelJob({
          workspaceId,
          jobId,
          actorUserId: ctx.auth.userId,
          requestId: requestIdOf(request),
        });
        return teacherJson({ job: cancelled });
      }
      case "review-question": {
        const ctx = await requireWorkspaceMember(request, workspaceId, [
          "owner",
          "admin",
          "teacher",
          "content_manager",
        ]);
        const parsed = reviewQuestionSchema.parse(body);
        const questionId = body.questionId as string;
        if (!questionId) {
          return teacherJson({ detail: "questionId is required in body." }, { status: 400 });
        }
        const question = await reviewQuestion({
          workspaceId,
          jobId,
          questionId,
          action: parsed.action,
          actorUserId: ctx.auth.userId,
          rejectionReason: parsed.rejectionReason,
          requestId: requestIdOf(request),
        });
        return teacherJson({ question });
      }
      case "bulk-accept": {
        const ctx = await requireWorkspaceMember(request, workspaceId, [
          "owner",
          "admin",
          "teacher",
          "content_manager",
        ]);
        const parsed = bulkAcceptSchema.parse(body);
        const accepted = await bulkAcceptReviewQuestions({
          workspaceId,
          jobId,
          questionIds: parsed.questionIds,
          actorUserId: ctx.auth.userId,
          requestId: requestIdOf(request),
        });
        return teacherJson({ acceptedCount: accepted });
      }
      case "create-test": {
        const ctx = await requireWorkspaceMember(request, workspaceId, ["owner", "admin", "teacher"]);
        const result = await createDraftTestFromImportJob({
          workspaceId,
          jobId,
          actorUserId: ctx.auth.userId,
          requestId: requestIdOf(request),
        });
        return teacherJson(result);
      }
      case "update-question": {
        const ctx = await requireWorkspaceMember(request, workspaceId, [
          "owner", "admin", "teacher", "content_manager",
        ]);
        const { questionId, ...fields } = updateQuestionSchema.parse(body);
        const question = await updateImportQuestion({
          workspaceId, jobId, questionId, actorUserId: ctx.auth.userId, fields,
          requestId: requestIdOf(request),
        });
        return teacherJson({ question });
      }
      case "apply-subject": {
        const ctx = await requireWorkspaceMember(request, workspaceId, [
          "owner", "admin", "teacher", "content_manager",
        ]);
        const { subject } = applySubjectSchema.parse(body);
        const count = await applyImportSubject({
          workspaceId, jobId, subject, actorUserId: ctx.auth.userId,
          requestId: requestIdOf(request),
        });
        return teacherJson({ updatedCount: count });
      }
      default:
        return teacherJson(
          { detail: "Invalid action. Use: cancel, review-question, bulk-accept, create-test, update-question, apply-subject." },
          { status: 400 },
        );
    }
  } catch (error) {
    return handleTeacherError(error);
  }
}
