import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { listPublications, submitForPublication } from "@/server/workspaces/ogcode-publishing-service";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "../../../_utils";

const submitSchema = z.object({
  ogcodeQuestionId: z.string(),
  questionBagQuestionId: z.string().nullable().optional(),
  hintProvided: z.boolean(),
  fullSolutionProvided: z.boolean(),
});

export async function GET(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("ogcodePublishing");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId);
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const allowed = ["pending_review", "approved", "rejected", "published", "superseded", "all"] as const;
    const status = rawStatus && allowed.includes(rawStatus as (typeof allowed)[number])
      ? (rawStatus as (typeof allowed)[number])
      : undefined;
    const publications = await listPublications(workspaceId, {
      status: status === "all" ? "all" : status,
      submittedBy: ctx.isPlatformAdmin ? undefined : ctx.auth.userId,
    });
    return teacherJson({ publications });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("ogcodePublishing");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner",
      "admin",
      "teacher",
      "content_manager",
    ]);
    const body = await parseJsonBody(request);
    const parsed = submitSchema.parse(body);
    const publication = await submitForPublication({
      workspaceId,
      ogcodeQuestionId: parsed.ogcodeQuestionId,
      questionBagQuestionId: parsed.questionBagQuestionId,
      submittedBy: ctx.auth.userId,
      hintProvided: parsed.hintProvided,
      fullSolutionProvided: parsed.fullSolutionProvided,
      requestId: requestIdOf(request),
    });
    await recordAuditEvent({
      actorUserId: ctx.auth.userId,
      workspaceId,
      entityType: "ogcode_publication",
      entityId: publication.id,
      action: "ogcode_publication.submitted",
      after: publication,
      requestId: requestIdOf(request),
    });
    return teacherJson({ publication }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
