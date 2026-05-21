import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import {
  getPublicationDetail,
  republishQuestion,
  reviewPublication,
  submitForReview,
} from "@/server/workspaces/ogcode-publishing-service";

import {
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "../../../../_utils";

const republishSchema = z.object({
  questionId: z.string(),
  questionVersionId: z.string(),
  attributionName: z.string().min(1).max(120),
  attributionLogoAssetId: z.string().nullable().optional(),
});

const reviewSchema = z.object({
  action: z.enum(["approve", "request_changes", "reject", "publish"]),
  notes: z.string().max(500).nullable().optional(),
});

export async function GET(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; publicationId: string }> },
) {
  try {
    requireFeatureEnabled("ogcodePublishing");
    const { workspaceId, publicationId } = await context.params;
    await requireWorkspaceMember(request, workspaceId);
    const publication = await getPublicationDetail(workspaceId, publicationId);
    if (!publication) {
      return teacherJson({ detail: "Publication not found." }, { status: 404 });
    }
    return teacherJson({ publication });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; publicationId: string }> },
) {
  try {
    requireFeatureEnabled("ogcodePublishing");
    const { workspaceId, publicationId } = await context.params;
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const body = await parseJsonBody(request);

    if (action === "review") {
      const auth = await requireRole(request, ["admin"]);
      const parsed = reviewSchema.parse(body);
      const result = await reviewPublication({
        publicationId,
        action: parsed.action,
        reviewerUserId: auth.userId,
        notes: parsed.notes,
        requestId: requestIdOf(request),
      });
      return teacherJson({ publication: result });
    }

    if (action === "republish") {
      const ctx = await requireWorkspaceMember(request, workspaceId, [
        "owner",
        "admin",
        "teacher",
        "content_manager",
      ]);
      const parsed = republishSchema.parse(body);
      const result = await republishQuestion({
        workspaceId,
        originalPublicationId: publicationId,
        questionId: parsed.questionId,
        questionVersionId: parsed.questionVersionId,
        contributorUserId: ctx.auth.userId,
        attributionName: parsed.attributionName,
        attributionLogoAssetId: parsed.attributionLogoAssetId,
        requestId: requestIdOf(request),
      });
      return teacherJson({
        newPublication: result.newPublication,
        archived: result.archived,
      });
    }

    if (action === "submit") {
      await requireWorkspaceMember(request, workspaceId, [
        "owner",
        "admin",
        "teacher",
        "content_manager",
      ]);
      const result = await submitForReview({ workspaceId, publicationId });
      if (!result) {
        return teacherJson(
          { detail: "Publication is not in draft/changes_requested state." },
          { status: 409 },
        );
      }
      return teacherJson({ publication: result });
    }

    return teacherJson(
      { detail: "Invalid action. Use: review, republish, submit." },
      { status: 400 },
    );
  } catch (error) {
    return handleTeacherError(error);
  }
}
