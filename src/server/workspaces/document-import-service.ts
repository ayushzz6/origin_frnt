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
import { updateQuestion } from "./questions";
import { createTeacherQuestion } from "./questions-service";
import { getActiveMembership } from "./store";
import { createTeacherTest } from "./tests-service";
import type { DocumentImportJob, ImportJobQuestion, ImportJobStatus, ImportJobWithProgress, ImportPageStatus, ImportQuestionStatus, ImportSourceType, ImportTargetSurface, QuestionOption, QuestionType } from "./types";

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
const VALID_QUESTION_TYPES: QuestionType[] = [
  "mcq", "msq", "numerical", "numerical_with_units",
  "symbolic_expression", "equation", "matrix_match", "subjective",
];
const VALID_DIFFICULTIES = ["easy", "medium", "hard", "insane"] as const;

function normalizeImportOptions(raw: Record<string, unknown> | null): QuestionOption[] | null {
  if (!raw) return null;
  const arr: unknown[] = Array.isArray(raw) ? raw : Object.values(raw);
  const opts = arr
    .map((entry, idx): QuestionOption => {
      const fallbackId = String.fromCharCode(97 + idx); // a, b, c, …
      if (entry && typeof entry === "object") {
        const rec = entry as Record<string, unknown>;
        const text = "text" in rec ? String(rec.text ?? "") : String(entry);
        const id = rec.id ? String(rec.id) : fallbackId;
        return { id, text };
      }
      return { id: fallbackId, text: String(entry ?? "") };
    })
    .filter((o) => o.text.trim().length > 0);
  return opts.length ? opts : null;
}

function normalizeDifficulty(raw: string | null): "easy" | "medium" | "hard" | "insane" {
  const value = (raw ?? "").trim().toLowerCase();
  return (VALID_DIFFICULTIES as readonly string[]).includes(value)
    ? (value as "easy" | "medium" | "hard" | "insane")
    : "medium";
}

/**
 * Publish a single accepted import question into the workspace Question Bag
 * (content.questions + content.question_versions) and mark the import row
 * `published` with a back-reference. Idempotent: a question that already has a
 * `questionBagQuestionId` is returned unchanged. Questions with an empty stem
 * are skipped (can't satisfy the bag's required-field invariants).
 *
 * Returns the content question id, or null when nothing was published.
 */
export async function publishImportQuestionToBag(input: {
  workspaceId: string;
  jobId: string;
  question: ImportJobQuestion;
  actorUserId: string;
  requestId?: string | null;
}): Promise<string | null> {
  const { question } = input;
  if (question.questionBagQuestionId) {
    // Already published in an earlier pass. Re-accepting flips the import row
    // back to 'accepted'; restore the 'published' status so state stays honest.
    if (question.status !== "published") {
      await updateQuestionStatus(input.jobId, question.id, "published", {
        questionBagQuestionId: question.questionBagQuestionId,
      });
    }
    return question.questionBagQuestionId;
  }
  const stem = (question.questionText ?? "").trim();
  if (!stem) return null;

  const options = normalizeImportOptions(question.options);
  const questionType: QuestionType =
    question.questionType && VALID_QUESTION_TYPES.includes(question.questionType as QuestionType)
      ? (question.questionType as QuestionType)
      : options
        ? "mcq"
        : "subjective";
  const correctOptions = Array.isArray(question.correctOptions)
    ? (question.correctOptions as unknown[]).map((n) => Number(n)).filter((n) => Number.isFinite(n))
    : null;

  const created = await createTeacherQuestion({
    workspaceId: input.workspaceId,
    createdBy: input.actorUserId,
    actorUserId: input.actorUserId,
    sourceKind: "imported",
    importedJobId: input.jobId,
    questionType,
    stem,
    options,
    correctOption: question.correctOption ?? null,
    correctOptions: correctOptions && correctOptions.length ? correctOptions : null,
    answerText: question.answerText ?? null,
    hint: question.hint ?? null,
    explanation: question.explanation ?? null,
    subject: (question.subject ?? "general").trim() || "general",
    chapter: (question.chapter ?? "general").trim() || "general",
    concept: (question.concept ?? question.chapter ?? "general").trim() || "general",
    difficulty: normalizeDifficulty(question.difficulty),
    tags: [],
    requestId: input.requestId,
  });

  // Mark it ready so it's usable in the test builder + DPP selection.
  await updateQuestion(created.id, { status: "ready" });
  await updateQuestionStatus(input.jobId, question.id, "published", {
    questionBagQuestionId: created.id,
  });
  return created.id;
}

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
    requestId: input.requestId,
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
      try {
        await publishImportQuestionToBag({
          workspaceId: input.workspaceId,
          jobId: input.jobId,
          question: updated,
          actorUserId: input.actorUserId,
          requestId: input.requestId,
        });
      } catch (error) {
        // One bad extraction shouldn't abort the whole batch — the row stays
        // 'accepted' and can be retried; surface in logs only.
        console.error("publishImportQuestionToBag failed (bulk)", { questionId, error });
      }
    }
  }
  return accepted;
}

/**
 * Build a DRAFT teacher test from an import job's questions. Publishes every
 * non-rejected question into the Question Bag (idempotent), then creates a draft
 * test referencing those bag questions in order with the dominant subject and a
 * filename-derived title. The teacher is then sent into the normal test-builder
 * (edit mode) to set description / batch / schedule and publish.
 */
export async function createDraftTestFromImportJob(input: {
  workspaceId: string;
  jobId: string;
  actorUserId: string;
  requestId?: string | null;
}): Promise<{ testId: string; questionCount: number }> {
  const membership = await getActiveMembership(input.workspaceId, input.actorUserId);
  if (!membership || !["owner", "admin", "teacher"].includes(membership.role)) {
    throw new AuthzError(403, "Insufficient permissions to create a test from this import.");
  }
  const job = await getImportJob(input.workspaceId, input.jobId);
  if (!job) throw new AuthzError(404, "Import job not found.");

  const all = await storeGetJobQuestions(input.jobId, { limit: 500 });
  const eligible = all.filter((q) => q.status !== "rejected");

  const contentIds: string[] = [];
  const subjectCount = new Map<string, number>();
  for (const question of eligible) {
    let bagId: string | null = null;
    try {
      bagId = await publishImportQuestionToBag({
        workspaceId: input.workspaceId,
        jobId: input.jobId,
        question,
        actorUserId: input.actorUserId,
        requestId: input.requestId,
      });
    } catch (error) {
      console.error("publishImportQuestionToBag failed (create-test)", { questionId: question.id, error });
    }
    if (bagId) {
      contentIds.push(bagId);
      const subj = (question.subject ?? "").trim().toLowerCase();
      if (subj && subj !== "general") subjectCount.set(subj, (subjectCount.get(subj) ?? 0) + 1);
    }
  }
  if (contentIds.length === 0) {
    throw new AuthzError(400, "Accept at least one question before creating a test.");
  }

  const dominantSubject = [...subjectCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "mixed";
  const baseName = job.sourceFileName.replace(/\.[^.]+$/u, "").slice(0, 160).trim() || "Imported";

  const test = await createTeacherTest({
    workspaceId: input.workspaceId,
    createdBy: input.actorUserId,
    actorUserId: input.actorUserId,
    title: `${baseName} — Imported`,
    description: `Auto-created from document import (${job.sourceFileName}).`,
    subject: dominantSubject,
    difficulty: "medium",
    durationMinutes: 60,
    status: "draft",
    questions: contentIds.map((id, idx) => ({
      position: idx + 1,
      sourceBank: "workspace_bag" as const,
      contentQuestionId: id,
      marks: 4,
      negativeMarks: -1,
    })),
    requestId: input.requestId,
  });

  return { testId: test.id, questionCount: contentIds.length };
}

export async function reviewQuestionService(input: {
  workspaceId: string; jobId: string; questionId: string; userId: string;
  status: ImportQuestionStatus; reviewNotes?: string | null; rejectionReason?: string | null;
  requestId?: string | null;
}): Promise<ImportJobQuestion | null> {
  const membership = await getActiveMembership(input.workspaceId, input.userId);
  if (!membership || !["owner", "admin", "teacher"].includes(membership.role)) {
    throw new AuthzError(403, "Insufficient permissions to review questions.");
  }
  let updated = await updateQuestionStatus(input.jobId, input.questionId, input.status, {
    reviewNotes: input.reviewNotes, rejectionReason: input.rejectionReason,
  });
  if (updated) {
    await recordAuditEvent({
      actorUserId: input.userId, workspaceId: input.workspaceId,
      entityType: "import_question", entityId: input.questionId, action: `import_question.${input.status}`,
      after: { id: updated.id, status: updated.status },
    });
    if (input.status === "accepted") {
      try {
        const bagId = await publishImportQuestionToBag({
          workspaceId: input.workspaceId,
          jobId: input.jobId,
          question: updated,
          actorUserId: input.userId,
          requestId: input.requestId,
        });
        if (bagId) {
          updated = { ...updated, status: "published", questionBagQuestionId: bagId };
        }
      } catch (error) {
        // Don't fail the accept if publishing hiccups; the row stays 'accepted'
        // and can be retried. Surface in logs only.
        console.error("publishImportQuestionToBag failed", { questionId: input.questionId, error });
      }
    }
  }
  return updated;
}
