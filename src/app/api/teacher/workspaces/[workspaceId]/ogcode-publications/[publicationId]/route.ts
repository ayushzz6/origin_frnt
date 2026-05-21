import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireAuth, requireRole } from "@/server/authz";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import {
  getPublicationDetail,
  republishQuestion,
  reviewPublication,
} from "@/server/workspaces/ogcode-publishing-service";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "../../../../_utils";

const republishSchema = z.object({
  ogcodeQuestionId: z.string(),
  questionBagQuestionId: z.string().nullable().optional(),
  hintProvided: z.boolean(),
  fullSolutionProvided: z.boolean(),
});

const reviewSchema = z.object({
  action: z.enum(["approve", "reject", "publish"]),
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
        workspaceId,
        publicationId,
        action: parsed.action,
        adminUserId: auth.userId,
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
        ogcodeQuestionId: parsed.ogcodeQuestionId,
        questionBagQuestionId: parsed.questionBagQuestionId,
        submittedBy: ctx.auth.userId,
        hintProvided: parsed.hintProvided,
        fullSolutionProvided: parsed.fullSolutionProvided,
        requestId: requestIdOf(request),
      });
      return teacherJson({
        newPublication: result.newPublication,
        superseded: result.superseded,
      });
    }

    return teacherJson({ detail: "Invalid action. Use: review, republish." }, { status: 400 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
