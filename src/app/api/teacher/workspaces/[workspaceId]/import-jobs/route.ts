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
  ImportJobBackpressureError,
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
  /** Plan: target_surface CHECK on import.document_import_jobs. */
  targetSurface: z.enum(["question_bag", "ogcode_draft", "admin_ogcode"]).optional(),
  /** FK to content.assets when the caller has pre-uploaded the source. */
  sourceAssetId: z.string().nullable().optional(),
  /** Hint to the verifier — accepts a fuzzy match within ±max(2, n/10). */
  requestedQuestionCount: z.number().int().positive().max(2000).nullable().optional(),
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

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return teacherJson({ detail: "A non-empty file is required." }, { status: 400 });
      }

      const sourceTypeRaw = String(formData.get("sourceType") ?? "pdf");
      const sourceType = createJobSchema.shape.sourceType.safeParse(sourceTypeRaw);
      if (!sourceType.success) {
        return teacherJson({ detail: "Invalid source type." }, { status: 400 });
      }

      const targetSurfaceRaw = formData.get("targetSurface");
      const targetSurface =
        targetSurfaceRaw === null
          ? undefined
          : createJobSchema.shape.targetSurface.safeParse(String(targetSurfaceRaw));

      const requestedRaw = formData.get("requestedQuestionCount");
      const requestedQuestionCount =
        requestedRaw === null || String(requestedRaw).trim() === ""
          ? undefined
          : Number.parseInt(String(requestedRaw), 10);

      const subject = String(formData.get("subject") ?? "").trim();
      const chapter = String(formData.get("chapter") ?? "").trim();
      const metadata: Record<string, unknown> = {};
      if (subject) metadata.subject = subject;
      if (chapter) metadata.chapter = chapter;

      const buffer = Buffer.from(await file.arrayBuffer());
      const job = await createImportJob({
        workspaceId,
        userId: ctx.auth.userId,
        sourceType: sourceType.data,
        fileName: file.name,
        mimeType: file.type || undefined,
        targetSurface: targetSurface?.success ? targetSurface.data : undefined,
        requestedQuestionCount:
          Number.isFinite(requestedQuestionCount) && requestedQuestionCount! > 0
            ? requestedQuestionCount
            : undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        sourceFile: {
          buffer,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
        },
      });
      return teacherJson({ job }, { status: 201 });
    }

    const body = await parseJsonBody(request);
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.message }, { status: 400 });
    }
    return teacherJson(
      { detail: "Multipart form upload with a file field is required." },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof ImportJobBackpressureError) {
      return teacherJson(
        {
          detail: error.message,
          errorCode: error.errorCode,
          activeJobs: error.active,
          concurrencyCap: error.cap,
        },
        {
          status: error.status,
          headers: { "Retry-After": "30" },
        },
      );
    }
    return handleTeacherError(error);
  }
}
