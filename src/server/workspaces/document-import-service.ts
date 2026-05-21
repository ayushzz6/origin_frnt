/**
 * Document import service (Phase 10).
 */

import { AuthzError } from "@/server/authz";

import { recordAuditEvent } from "./audit";
import {
  addJobPage,
  addJobQuestion,
  createImportJob as storeCreateImportJob,
  getImportJob,
  getJobPages as storeGetJobPages,
  getJobQuestions as storeGetJobQuestions,
  getJobWithProgress as storeGetJobWithProgress,
  listWorkspaceImportJobs as storeListWorkspaceImportJobs,
  updateImportJobStatus,
  updateQuestionStatus,
} from "./document-import-store";
import { getActiveMembership } from "./store";
import type { DocumentImportJob, ImportJobQuestion, ImportJobStatus, ImportJobWithProgress, ImportPageStatus, ImportQuestionStatus, ImportSourceType } from "./types";

export async function createImportJob(input: {
  workspaceId: string; userId: string; sourceType: ImportSourceType; fileName: string;
  mimeType?: string | null; content?: string | null; fileUrl?: string | null;
  chunkSize?: number | null; overlap?: number | null; metadata?: Record<string, unknown>;
}): Promise<DocumentImportJob> {
  const membership = await getActiveMembership(input.workspaceId, input.userId);
  if (!membership || !["owner", "admin", "teacher"].includes(membership.role)) {
    throw new AuthzError(403, "Insufficient permissions to create import jobs.");
  }
  const job = await storeCreateImportJob({
    workspaceId: input.workspaceId, userId: input.userId, sourceType: input.sourceType,
    fileName: input.fileName, mimeType: input.mimeType, content: input.content,
    fileUrl: input.fileUrl, chunkSize: input.chunkSize, overlap: input.overlap,
    metadata: input.metadata,
  });
  await recordAuditEvent({
    actorUserId: input.userId, workspaceId: input.workspaceId,
    entityType: "document_import_job", entityId: job.id, action: "import_job.created",
    after: { id: job.id, sourceType: job.sourceType, fileName: job.sourceFileName },
  });
  return job;
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
