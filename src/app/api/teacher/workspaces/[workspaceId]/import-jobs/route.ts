/**
 * GET  /api/teacher/workspaces/[workspaceId]/import-jobs        — list workspace import jobs
 * POST /api/teacher/workspaces/[workspaceId]/import-jobs        — create a new job
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import {
  createImportJob,
  listWorkspaceImportJobs,
} from "@/server/workspaces/document-import-service";

import {
  getWorkspaceId,
  handleTeacherError,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "../../../_utils";

const createJobSchema = z.object({
  sourceType: z.enum(["pdf", "docx", "txt", "image", "url"]),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().max(120).nullable().optional(),
  content: z.string().nullable().optional(),
  fileUrl: z.string().url().nullable().optional(),
  chunkSize: z.number().int().positive().nullable().optional(),
  overlap: z.number().int().min(0).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const JOB_STATUS_VALUES = [
  "queued",
  "processing",
  "needs_review",
  "succeeded",
  "failed",
  "cancelled",
  "all",
] as const;

export async function GET(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("documentImport");
    const workspaceId = await getWorkspaceId(context);
    await requireWorkspaceMember(request, workspaceId);
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const status =
      rawStatus && JOB_STATUS_VALUES.includes(rawStatus as (typeof JOB_STATUS_VALUES)[number])
        ? (rawStatus as (typeof JOB_STATUS_VALUES)[number])
        : undefined;
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const jobs = await listWorkspaceImportJobs(workspaceId, {
      status: status === "all" || status === undefined ? undefined : status,
      limit: Math.min(Math.max(limit, 1), 100),
    });
    return teacherJson({ jobs });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("documentImport");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner",
      "admin",
      "teacher",
      "content_manager",
    ]);
    const body = await parseJsonBody(request);
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.message }, { status: 400 });
    }
    const job = await createImportJob({
      workspaceId,
      userId: ctx.auth.userId,
      sourceType: parsed.data.sourceType,
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      content: parsed.data.content,
      fileUrl: parsed.data.fileUrl,
      chunkSize: parsed.data.chunkSize,
      overlap: parsed.data.overlap,
      metadata: parsed.data.metadata,
    });
    return teacherJson({ job }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
