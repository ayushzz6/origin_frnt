/**
 * Document import service (Phase 10).
 */

import { AuthzError } from "@/server/authz";
import { uploadImportDocumentToR2 } from "@/server/media-storage";

import { recordAuditEvent } from "./audit";
import {
  addJobPage,
  addJobQuestion,
  countActiveImportJobs,
  createImportJob as storeCreateImportJob,
  getImportJob,
  getJobPages as storeGetJobPages,
  getJobQuestions as storeGetJobQuestions,
  getJobWithProgress as storeGetJobWithProgress,
  listWorkspaceImportJobs as storeListWorkspaceImportJobs,
  updateImportJobStatus,
  updateQuestionStatus,
} from "./document-import-store";
import { createDocumentImportJobId } from "./ids";
import { getActiveMembership } from "./store";
import type { DocumentImportJob, ImportJobQuestion, ImportJobStatus, ImportJobWithProgress, ImportPageStatus, ImportQuestionStatus, ImportSourceType, ImportTargetSurface } from "./types";

/** Cap on simultaneously queued+processing jobs per workspace. Phase 13
 * backpressure — protects the document-import worker from being swamped
 * by a single workspace bulk-uploading. Tunable via env. */
function importJobConcurrencyCap(): number {
  const raw = process.env.DOCUMENT_IMPORT_WORKSPACE_CONCURRENCY?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

export class ImportJobBackpressureError extends Error {
  status = 429 as const;
  errorCode = "IMPORT_JOB_BACKPRESSURE" as const;
  constructor(public readonly active: number, public readonly cap: number) {
    super(
      `Import queue is at capacity (${active}/${cap} active jobs). Wait for in-flight jobs to finish before submitting more.`,
    );
    this.name = "ImportJobBackpressureError";
  }
}

export async function createImportJob(input: {
  workspaceId: string; userId: string; sourceType: ImportSourceType; fileName: string;
  mimeType?: string | null; content?: string | null; fileUrl?: string | null;
  chunkSize?: number | null; overlap?: number | null; metadata?: Record<string, unknown>;
  targetSurface?: ImportTargetSurface;
  sourceAssetId?: string | null;
  requestedQuestionCount?: number | null;
  /** Source file bytes — uploaded to R2 before the job row is inserted. */
  sourceFile?: { buffer: Buffer; fileName: string; mimeType: string };
  /** When true, fire-and-forget kicks off the FastAPI worker after the
   * job row is committed. Defaults to true — set false in tests to keep
   * the pipeline call out of the request. */
  triggerPipeline?: boolean;
}): Promise<DocumentImportJob> {
  const membership = await getActiveMembership(input.workspaceId, input.userId);
  if (!membership || !["owner", "admin", "teacher", "content_manager"].includes(membership.role)) {
    throw new AuthzError(403, "Insufficient permissions to create import jobs.");
  }
  const cap = importJobConcurrencyCap();
  const active = await countActiveImportJobs(input.workspaceId);
  if (active >= cap) {
    throw new ImportJobBackpressureError(active, cap);
  }

  const jobId = createDocumentImportJobId();
  let sourceR2ObjectKey: string | undefined;
  let sourceR2Bucket: string | undefined;
  let sourceSizeBytes: number | undefined;
  let sourceSha256: string | undefined;

  if (input.sourceFile) {
    const uploaded = await uploadImportDocumentToR2({
      jobId,
      fileName: input.sourceFile.fileName,
      mimeType: input.sourceFile.mimeType,
      body: input.sourceFile.buffer,
    });
    sourceR2ObjectKey = uploaded.objectKey;
    sourceR2Bucket = uploaded.bucket;
    sourceSizeBytes = uploaded.sizeBytes;
    sourceSha256 = uploaded.sha256;
  }

  const job = await storeCreateImportJob({
    id: jobId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    sourceType: input.sourceType,
    fileName: input.fileName,
    mimeType: input.mimeType,
    content: input.content,
    fileUrl: input.fileUrl,
    chunkSize: input.chunkSize,
    overlap: input.overlap,
    metadata: input.metadata,
    targetSurface: input.targetSurface,
    sourceAssetId: input.sourceAssetId,
    requestedQuestionCount: input.requestedQuestionCount,
    sourceR2ObjectKey,
    sourceR2Bucket,
    sourceSizeBytes,
    sourceSha256,
  });
  await recordAuditEvent({
    actorUserId: input.userId, workspaceId: input.workspaceId,
    entityType: "document_import_job", entityId: job.id, action: "import_job.created",
    after: { id: job.id, sourceType: job.sourceType, fileName: job.sourceFileName },
  });

  if (input.triggerPipeline !== false) {
    // Fire-and-forget the pipeline so callers don't block on it.
    triggerImportPipeline(job).catch((err: unknown) => {
      // Swallowed deliberately — pipeline failures are reflected in the
      // job row (status='failed', error_code/message set by the worker).
      console.warn(`[document-import] pipeline trigger failed for ${job.id}:`, err);
    });
  }

  return job;
}

/** POST /v1/import-jobs/{id}/run on the document-import-service.
 * No-op when DOCUMENT_IMPORT_SERVICE_URL isn't configured (dev env). */
export async function triggerImportPipeline(job: DocumentImportJob): Promise<void> {
  const baseUrl = process.env.DOCUMENT_IMPORT_SERVICE_URL?.trim();
  const token = process.env.DOCUMENT_IMPORT_SERVICE_TOKEN?.trim();
  if (!baseUrl || !token) return;

  const requestId =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  await fetch(`${baseUrl.replace(/\/$/, "")}/v1/import-jobs/${job.id}/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-request-id": requestId,
    },
    body: JSON.stringify({
      job_id: job.id,
      requested_by: job.requestedBy,
      workspace_id: job.workspaceId,
    }),
  });
}

export async function listWorkspaceImportJobs(workspaceId: string, filter?: { status?: ImportJobStatus; limit?: number }): Promise<DocumentImportJob[]> {
  return storeListWorkspaceImportJobs(workspaceId, filter);
}

export async function getJobWithProgress(workspaceId: string, jobId: string): Promise<ImportJobWithProgress | null> {
  return storeGetJobWithProgress(workspaceId, jobId);
}

export async function getJobPages(jobId: string, filter?: { status?: ImportPageStatus }) {
  return storeGetJobPages(jobId, filter);
}

export async function getJobQuestions(
  jobId: string,
  filter?: { status?: ImportQuestionStatus | "all"; limit?: number },
) {
  // store accepts a specific status only; "all" means no filter.
  const storeFilter =
    filter?.status && filter.status !== "all"
      ? { status: filter.status as ImportQuestionStatus, limit: filter.limit }
      : { limit: filter?.limit };
  return storeGetJobQuestions(jobId, storeFilter);
}

export async function updateJobStatusService(input: {
  workspaceId: string; jobId: string; userId: string; status: ImportJobStatus;
  extra?: {
    totalPages?: number | null; processedPages?: number; totalQuestions?: number | null;
    acceptedQuestions?: number; reviewRequiredQuestions?: number; errorMessage?: string | null;
    startedAt?: string | null; completedAt?: string | null;
  };
}): Promise<DocumentImportJob | null> {
  const job = await getImportJob(input.workspaceId, input.jobId);
  if (!job) throw new AuthzError(404, "Import job not found.");
  // store signature is (jobId, workspaceId, status, extra)
  const updated = await updateImportJobStatus(input.jobId, input.workspaceId, input.status, input.extra);
  if (updated) {
    await recordAuditEvent({
      actorUserId: input.userId, workspaceId: input.workspaceId,
      entityType: "document_import_job", entityId: input.jobId, action: `import_job.${input.status}`,
      before: job, after: updated,
    });
  }
  return updated;
}

/** Owner/admin/teacher can cancel a non-terminal job. */
export async function cancelJob(input: {
  workspaceId: string; jobId: string; actorUserId: string; requestId?: string | null;
}): Promise<DocumentImportJob | null> {
  const membership = await getActiveMembership(input.workspaceId, input.actorUserId);
  if (!membership || !["owner", "admin", "teacher"].includes(membership.role)) {
    throw new AuthzError(403, "Insufficient permissions to cancel import jobs.");
  }
  return updateJobStatusService({
    workspaceId: input.workspaceId,
    jobId: input.jobId,
    userId: input.actorUserId,
    status: "cancelled",
  });
}

/** Accept a single review-required question (or reject it). */
export async function reviewQuestion(input: {
  workspaceId: string; jobId: string; questionId: string;
  action: "accept" | "reject";
  actorUserId: string;
  rejectionReason?: string | null;
  requestId?: string | null;
}): Promise<ImportJobQuestion | null> {
  const status: ImportQuestionStatus = input.action === "accept" ? "accepted" : "rejected";
  return reviewQuestionService({
    workspaceId: input.workspaceId,
    jobId: input.jobId,
    questionId: input.questionId,
    userId: input.actorUserId,
    status,
    rejectionReason: input.action === "reject" ? input.rejectionReason ?? null : null,
  });
}

/** Bulk-accept several review-required questions in one call. Returns the
 * count of questions actually transitioned. */
export async function bulkAcceptReviewQuestions(input: {
  workspaceId: string; jobId: string; questionIds: string[];
  actorUserId: string; requestId?: string | null;
}): Promise<number> {
  const membership = await getActiveMembership(input.workspaceId, input.actorUserId);
  if (!membership || !["owner", "admin", "teacher", "content_manager"].includes(membership.role)) {
    throw new AuthzError(403, "Insufficient permissions to bulk-accept import questions.");
  }
  let accepted = 0;
  for (const questionId of input.questionIds) {
    const updated = await updateQuestionStatus(input.jobId, questionId, "accepted");
    if (updated) {
      accepted += 1;
      await recordAuditEvent({
        actorUserId: input.actorUserId,
        workspaceId: input.workspaceId,
        entityType: "import_question",
        entityId: questionId,
        action: "import_question.accepted",
        after: { id: updated.id, status: updated.status },
        requestId: input.requestId,
      });
    }
  }
  return accepted;
}

export async function reviewQuestionService(input: {
  workspaceId: string; jobId: string; questionId: string; userId: string;
  status: ImportQuestionStatus; reviewNotes?: string | null; rejectionReason?: string | null;
}): Promise<ImportJobQuestion | null> {
  const membership = await getActiveMembership(input.workspaceId, input.userId);
  if (!membership || !["owner", "admin", "teacher"].includes(membership.role)) {
    throw new AuthzError(403, "Insufficient permissions to review questions.");
  }
  const updated = await updateQuestionStatus(input.jobId, input.questionId, input.status, {
    reviewNotes: input.reviewNotes, rejectionReason: input.rejectionReason,
  });
  if (updated) {
    await recordAuditEvent({
      actorUserId: input.userId, workspaceId: input.workspaceId,
      entityType: "import_question", entityId: input.questionId, action: `import_question.${input.status}`,
      after: { id: updated.id, status: updated.status },
    });
  }
  return updated;
}
