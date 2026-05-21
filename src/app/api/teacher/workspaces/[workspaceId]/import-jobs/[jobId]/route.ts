import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import {
  bulkAcceptReviewQuestions,
  cancelJob,
  getJobPages,
  getJobQuestions,
  getJobWithProgress,
  reviewQuestion,
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
      default:
        return teacherJson({ detail: "Invalid action. Use: cancel, review-question, bulk-accept." }, { status: 400 });
    }
  } catch (error) {
    return handleTeacherError(error);
  }
}
