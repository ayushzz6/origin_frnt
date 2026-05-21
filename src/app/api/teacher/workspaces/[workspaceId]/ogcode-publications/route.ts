import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
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
  questionId: z.string(),
  questionVersionId: z.string(),
  attributionName: z.string().min(1).max(120),
  attributionLogoAssetId: z.string().nullable().optional(),
});

const STATUS_VALUES = [
  "draft",
  "submitted",
  "approved",
  "published",
  "changes_requested",
  "rejected",
  "archived",
  "all",
] as const;

export async function GET(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("ogcodePublishing");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId);
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const status = rawStatus && STATUS_VALUES.includes(rawStatus as (typeof STATUS_VALUES)[number])
      ? (rawStatus as (typeof STATUS_VALUES)[number])
      : undefined;
    const publications = await listPublications(workspaceId, {
      status: status === "all" ? "all" : status,
      contributorUserId: ctx.isPlatformAdmin ? undefined : ctx.auth.userId,
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
    // submitForPublication enforces the publish gate server-side
    // (reads content.question_versions, doesn't trust client booleans)
    // and records the audit event itself, so no separate audit call here.
    const publication = await submitForPublication({
      workspaceId,
      questionId: parsed.questionId,
      questionVersionId: parsed.questionVersionId,
      contributorUserId: ctx.auth.userId,
      attributionName: parsed.attributionName,
      attributionLogoAssetId: parsed.attributionLogoAssetId,
      requestId: requestIdOf(request),
    });
    return teacherJson({ publication }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
