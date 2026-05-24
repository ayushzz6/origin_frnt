/**
 * Document import store (Phase 10).
 */

import type { Pool } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";

import { createDocumentImportJobId, createImportJobPageId, createImportJobQuestionId } from "./ids";
import { ensureDocumentImportSchema } from "./document-import-schema";
import type { DocumentImportJob, ImportJobPage, ImportJobQuestion, ImportJobStage, ImportJobStatus, ImportJobWithProgress, ImportPageStatus, ImportQuestionStatus, ImportSourceType, ImportTargetSurface } from "./types";

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function rowToJob(row: Record<string, unknown>): DocumentImportJob {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    sourceType: row.source_type as ImportSourceType,
    sourceFileName: row.source_file_name as string,
    sourceR2ObjectKey: row.source_r2_object_key as string,
    sourceR2Bucket: row.source_r2_bucket as string,
    sourceMimeType: row.source_mime_type as string,
    sourceSizeBytes: Number(row.source_size_bytes) || 0,
    sourceSha256: row.source_sha256 as string,
    sourceAssetId: (row.source_asset_id as string | null) ?? null,
    subject: (row.subject as string | null) ?? null,
    chapter: (row.chapter as string | null) ?? null,
    targetSurface: (row.target_surface as ImportTargetSurface | null) ?? "question_bag",
    status: row.status as ImportJobStatus,
    stage: ((row.stage as ImportJobStage | null) ?? "queued"),
    totalPages: (row.total_pages as number | null) ?? null,
    processedPages: Number(row.processed_pages) || 0,
    totalQuestions: (row.total_questions as number | null) ?? null,
    requestedQuestionCount: (row.requested_question_count as number | null) ?? null,
    acceptedQuestions: Number(row.accepted_questions) || 0,
    reviewRequiredQuestions: Number(row.review_required_questions) || 0,
    classification: (row.classification as Record<string, unknown>) ?? {},
    diagnostics: (row.diagnostics as Record<string, unknown>) ?? {},
    cost: (row.cost as Record<string, unknown>) ?? {},
    errorCode: (row.error_code as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    startedAt: row.started_at ? new Date(row.started_at as string).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at as string).toISOString() : null,
    createdBy: row.created_by as string,
    requestedBy: (row.requested_by as string | null) ?? (row.created_by as string),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

function rowToPage(row: Record<string, unknown>): ImportJobPage {
  return {
    id: row.id as string, jobId: row.job_id as string, pageNumber: Number(row.page_number) || 0,
    status: row.status as ImportPageStatus, extractedText: (row.extracted_text as string | null) ?? null,
    extractedImages: (row.extracted_images as Record<string, unknown>[]) ?? [],
    reviewNotes: (row.review_notes as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

function rowToQuestion(row: Record<string, unknown>): ImportJobQuestion {
  return {
    id: row.id as string, jobId: row.job_id as string, pageId: (row.page_id as string | null) ?? null,
    questionNumber: (row.question_number as number | null) ?? null,
    questionType: (row.question_type as string | null) ?? null,
    subject: (row.subject as string | null) ?? null, chapter: (row.chapter as string | null) ?? null,
    concept: (row.concept as string | null) ?? null,
    questionText: (row.question_text as string | null) ?? null,
    options: (row.options as Record<string, unknown> | null) ?? null,
    correctOption: (row.correct_option as number | null) ?? null,
    correctOptions: (row.correct_options as Record<string, unknown> | null) ?? null,
    answerText: (row.answer_text as string | null) ?? null,
    explanation: (row.explanation as string | null) ?? null, hint: (row.hint as string | null) ?? null,
    hasDiagram: Boolean(row.has_diagram), diagramDescription: (row.diagram_description as string | null) ?? null,
    status: row.status as ImportQuestionStatus,
    confidenceScore: row.confidence_score ? Number(row.confidence_score) : null,
    reviewNotes: (row.review_notes as string | null) ?? null,
    rejectionReason: (row.rejection_reason as string | null) ?? null,
    questionBagQuestionId: (row.question_bag_question_id as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export async function createImportJob(input: {
  workspaceId: string;
  userId: string;
  sourceType: ImportSourceType;
  fileName: string;
  mimeType?: string | null;
  content?: string | null;
  fileUrl?: string | null;
  chunkSize?: number | null;
  overlap?: number | null;
  metadata?: Record<string, unknown>;
  /** Where these imported questions will land — drives validation + the
   * review UI's "submit to OGCode" gating later. */
  targetSurface?: ImportTargetSurface;
  /** Optional FK to content.assets when Next.js has uploaded the source
   * file via the asset pipeline first. */
  sourceAssetId?: string | null;
  /** Asked-for question count, used by the verifier's count check. */
  requestedQuestionCount?: number | null;
}): Promise<DocumentImportJob> {
  await ensureDocumentImportSchema();
  const id = createDocumentImportJobId();
  const r2Key = `imports/${id}/${input.fileName}`;
  const result = await pool().query(
    `INSERT INTO import.document_import_jobs (
       id, workspace_id, source_type, source_file_name,
       source_r2_object_key, source_r2_bucket, source_mime_type, source_size_bytes,
       source_sha256, source_asset_id, target_surface,
       created_by, requested_by, requested_question_count, metadata
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
     RETURNING *`,
    [
      id,
      input.workspaceId,
      input.sourceType,
      input.fileName,
      r2Key,
      "origin-imports",
      input.mimeType ?? "application/octet-stream",
      0,
      "pending-upload",
      input.sourceAssetId ?? null,
      input.targetSurface ?? "question_bag",
      input.userId,
      input.userId,
      input.requestedQuestionCount ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return rowToJob(result.rows[0]);
}

export async function getImportJob(workspaceId: string, jobId: string): Promise<DocumentImportJob | null> {
  await ensureDocumentImportSchema();
  const result = await pool().query(
    `SELECT * FROM import.document_import_jobs WHERE id = $1 AND workspace_id = $2`,
    [jobId, workspaceId],
  );
  return result.rows[0] ? rowToJob(result.rows[0]) : null;
}

export async function listWorkspaceImportJobs(workspaceId: string, filter?: { status?: ImportJobStatus; limit?: number }): Promise<DocumentImportJob[]> {
  await ensureDocumentImportSchema();
  const params: unknown[] = [workspaceId];
  let where = "workspace_id = $1";
  if (filter?.status) { params.push(filter.status); where += ` AND status = $${params.length}`; }
  const limit = filter?.limit ?? 50;
  const result = await pool().query(
    `SELECT * FROM import.document_import_jobs WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length + 1}`,
    [...params, limit],
  );
  return result.rows.map(rowToJob);
}

export async function getJobPages(jobId: string, filter?: { status?: ImportPageStatus }): Promise<ImportJobPage[]> {
  await ensureDocumentImportSchema();
  const params: unknown[] = [jobId];
  let where = "job_id = $1";
  if (filter?.status) { params.push(filter.status); where += ` AND status = $${params.length}`; }
  const result = await pool().query(
    `SELECT * FROM import.import_job_pages WHERE ${where} ORDER BY page_number`,
    params,
  );
  return result.rows.map(rowToPage);
}

export async function getJobQuestions(jobId: string, filter?: { status?: ImportQuestionStatus; limit?: number }): Promise<ImportJobQuestion[]> {
  await ensureDocumentImportSchema();
  const params: unknown[] = [jobId];
  let where = "job_id = $1";
  if (filter?.status) { params.push(filter.status); where += ` AND status = $${params.length}`; }
  const limit = filter?.limit ?? 100;
  const result = await pool().query(
    `SELECT * FROM import.import_job_questions WHERE ${where} ORDER BY question_number NULLS FIRST LIMIT $${params.length + 1}`,
    [...params, limit],
  );
  return result.rows.map(rowToQuestion);
}

export async function updateImportJobStatus(jobId: string, workspaceId: string, status: ImportJobStatus, extra?: {
  totalPages?: number | null; processedPages?: number; totalQuestions?: number | null;
  acceptedQuestions?: number; reviewRequiredQuestions?: number; errorMessage?: string | null;
  startedAt?: string | null; completedAt?: string | null;
}): Promise<DocumentImportJob | null> {
  await ensureDocumentImportSchema();
  const fields = ["status = $3", "updated_at = NOW()"];
  const params: unknown[] = [jobId, workspaceId, status];
  let i = 4;
  if (extra?.totalPages !== undefined) { fields.push(`total_pages = $${i++}`); params.push(extra.totalPages); }
  if (extra?.processedPages !== undefined) { fields.push(`processed_pages = $${i++}`); params.push(extra.processedPages); }
  if (extra?.totalQuestions !== undefined) { fields.push(`total_questions = $${i++}`); params.push(extra.totalQuestions); }
  if (extra?.acceptedQuestions !== undefined) { fields.push(`accepted_questions = $${i++}`); params.push(extra.acceptedQuestions); }
  if (extra?.reviewRequiredQuestions !== undefined) { fields.push(`review_required_questions = $${i++}`); params.push(extra.reviewRequiredQuestions); }
  if (extra?.errorMessage !== undefined) { fields.push(`error_message = $${i++}`); params.push(extra.errorMessage); }
  if (extra?.startedAt !== undefined) { fields.push(`started_at = $${i++}`); params.push(extra.startedAt); }
  if (extra?.completedAt !== undefined) { fields.push(`completed_at = $${i++}`); params.push(extra.completedAt); }
  params.push(jobId, workspaceId);
  const result = await pool().query(
    `UPDATE import.document_import_jobs SET ${fields.join(", ")} WHERE id = $${i++} AND workspace_id = $${i} RETURNING *`,
    params,
  );
  return result.rows[0] ? rowToJob(result.rows[0]) : null;
}

export async function addJobPage(jobId: string, pageNumber: number, extra?: {
  status?: ImportPageStatus; extractedText?: string | null; extractedImages?: Record<string, unknown>[];
}): Promise<ImportJobPage> {
  await ensureDocumentImportSchema();
  const id = createImportJobPageId();
  const result = await pool().query(
    `INSERT INTO import.import_job_pages (id, job_id, page_number, status, extracted_text, extracted_images)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING *`,
    [id, jobId, pageNumber, extra?.status ?? "pending", extra?.extractedText ?? null,
     JSON.stringify(extra?.extractedImages ?? [])],
  );
  return rowToPage(result.rows[0]);
}

export async function addJobQuestion(jobId: string, pageId: string | null, extra?: {
  questionNumber?: number | null; questionType?: string | null; subject?: string | null;
  chapter?: string | null; concept?: string | null; questionText?: string | null;
  options?: Record<string, unknown> | null; correctOption?: number | null;
  correctOptions?: Record<string, unknown> | null; answerText?: string | null;
  explanation?: string | null; hint?: string | null; hasDiagram?: boolean;
  diagramDescription?: string | null; status?: ImportQuestionStatus;
  confidenceScore?: number | null;
}): Promise<ImportJobQuestion> {
  await ensureDocumentImportSchema();
  const id = createImportJobQuestionId();
  const result = await pool().query(
    `INSERT INTO import.import_job_questions (id, job_id, page_id, question_number, question_type,
       subject, chapter, concept, question_text, options, correct_option, correct_options,
       answer_text, explanation, hint, has_diagram, diagram_description, status, confidence_score)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::jsonb,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
    [id, jobId, pageId, extra?.questionNumber ?? null, extra?.questionType ?? null,
     extra?.subject ?? null, extra?.chapter ?? null, extra?.concept ?? null,
     extra?.questionText ?? null, extra?.options ? JSON.stringify(extra.options) : null,
     extra?.correctOption ?? null, extra?.correctOptions ? JSON.stringify(extra.correctOptions) : null,
     extra?.answerText ?? null, extra?.explanation ?? null, extra?.hint ?? null,
     extra?.hasDiagram ?? false, extra?.diagramDescription ?? null,
     extra?.status ?? "draft", extra?.confidenceScore ?? null],
  );
  return rowToQuestion(result.rows[0]);
}

export async function updateQuestionStatus(jobId: string, questionId: string, status: ImportQuestionStatus, extra?: {
  reviewNotes?: string | null; rejectionReason?: string | null; questionBagQuestionId?: string | null;
}): Promise<ImportJobQuestion | null> {
  await ensureDocumentImportSchema();
  const fields = ["status = $3", "updated_at = NOW()"];
  const params: unknown[] = [jobId, questionId, status];
  let i = 4;
  if (extra?.reviewNotes !== undefined) { fields.push(`review_notes = $${i++}`); params.push(extra.reviewNotes); }
  if (extra?.rejectionReason !== undefined) { fields.push(`rejection_reason = $${i++}`); params.push(extra.rejectionReason); }
  if (extra?.questionBagQuestionId !== undefined) { fields.push(`question_bag_question_id = $${i++}`); params.push(extra.questionBagQuestionId); }
  params.push(questionId, jobId);
  const result = await pool().query(
    `UPDATE import.import_job_questions SET ${fields.join(", ")} WHERE id = $${i++} AND job_id = $${i} RETURNING *`,
    params,
  );
  return result.rows[0] ? rowToQuestion(result.rows[0]) : null;
}

export async function getJobWithProgress(workspaceId: string, jobId: string): Promise<ImportJobWithProgress | null> {
  await ensureDocumentImportSchema();
  const job = await getImportJob(workspaceId, jobId);
  if (!job) return null;
  const questions = await getJobQuestions(jobId, { limit: 20 });
  const progressPercent = job.totalPages ? Math.round((job.processedPages / job.totalPages) * 100) : 0;
  return { ...job, progressPercent, questionsPreview: questions };
}
