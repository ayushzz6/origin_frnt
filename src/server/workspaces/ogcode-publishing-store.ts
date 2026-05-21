/**
 * Postgres-backed store for OGCode publishing (Phase 9).
 */

import type { Pool } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";

import { createOgcodePublicationId } from "./ids";
import { ensureOgcodePublishingSchema } from "./ogcode-publishing-schema";
import type {
  OgcodePublication,
  OgcodePublicationStatus,
  OgcodePublicationWithQuestion,
} from "./types";

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function rowToPublication(row: Record<string, unknown>): OgcodePublication {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    ogcodeQuestionId: row.ogcode_question_id as string,
    questionBagQuestionId: (row.question_bag_question_id as string | null) ?? null,
    submittedBy: row.submitted_by as string,
    status: row.status as OgcodePublicationStatus,
    version: row.version as number,
    hintProvided: row.hint_provided as boolean,
    fullSolutionProvided: row.full_solution_provided as boolean,
    adminReviewedBy: (row.admin_reviewed_by as string | null) ?? null,
    adminReviewedAt: row.admin_reviewed_at ? new Date(row.admin_reviewed_at as string).toISOString() : null,
    adminNotes: (row.admin_notes as string | null) ?? null,
    publishedAt: row.published_at ? new Date(row.published_at as string).toISOString() : null,
    rejectedAt: row.rejected_at ? new Date(row.rejected_at as string).toISOString() : null,
    supersededBy: (row.superseded_by as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export type CreateOgcodePublicationInput = {
  workspaceId: string;
  ogcodeQuestionId: string;
  questionBagQuestionId?: string | null;
  submittedBy: string;
  hintProvided: boolean;
  fullSolutionProvided: boolean;
  metadata?: Record<string, unknown>;
};

export async function createOgcodePublication(input: CreateOgcodePublicationInput): Promise<OgcodePublication> {
  await ensureOgcodePublishingSchema();
  const id = createOgcodePublicationId();
  const result = await pool().query(
    `INSERT INTO content.ogcode_publications (
       id, workspace_id, ogcode_question_id, question_bag_question_id,
       submitted_by, hint_provided, full_solution_provided, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     RETURNING *`,
    [
      id,
      input.workspaceId,
      input.ogcodeQuestionId,
      input.questionBagQuestionId ?? null,
      input.submittedBy,
      input.hintProvided,
      input.fullSolutionProvided,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return rowToPublication(result.rows[0]);
}

export async function getOgcodePublication(
  workspaceId: string,
  publicationId: string,
): Promise<OgcodePublication | null> {
  await ensureOgcodePublishingSchema();
  const result = await pool().query(
    `SELECT * FROM content.ogcode_publications WHERE id = $1 AND workspace_id = $2`,
    [publicationId, workspaceId],
  );
  return result.rows[0] ? rowToPublication(result.rows[0]) : null;
}

export async function listOgcodePublications(
  workspaceId: string,
  filter?: { status?: OgcodePublicationStatus | "all"; submittedBy?: string },
): Promise<OgcodePublication[]> {
  await ensureOgcodePublishingSchema();
  const params: unknown[] = [workspaceId];
  let where = "workspace_id = $1";
  if (filter?.status && filter.status !== "all") {
    params.push(filter.status);
    where += ` AND status = $${params.length}`;
  }
  if (filter?.submittedBy) {
    params.push(filter.submittedBy);
    where += ` AND submitted_by = $${params.length}`;
  }
  const result = await pool().query(
    `SELECT * FROM content.ogcode_publications
     WHERE ${where}
     ORDER BY created_at DESC`,
    params,
  );
  return result.rows.map(rowToPublication);
}

export async function listPendingReviewPublications(
  limit?: number,
): Promise<OgcodePublicationWithQuestion[]> {
  await ensureOgcodePublishingSchema();
  const maxLimit = limit ?? 50;
  const result = await pool().query(
    `SELECT p.*,
            q.title AS question_title,
            q.subject AS question_subject,
            q.chapter AS question_chapter
     FROM content.ogcode_publications p
     LEFT JOIN assessment.questions q ON q.id = p.ogcode_question_id
     WHERE p.status = 'pending_review'
     ORDER BY p.created_at ASC
     LIMIT $1`,
    [maxLimit],
  );
  return result.rows.map((row) => ({
    ...rowToPublication(row),
    questionTitle: (row.question_title as string | null) ?? null,
    questionSubject: (row.question_subject as string | null) ?? null,
    questionChapter: (row.question_chapter as string | null) ?? null,
  }));
}

export async function approvePublication(input: {
  workspaceId: string;
  publicationId: string;
  adminUserId: string;
  notes?: string | null;
}): Promise<OgcodePublication | null> {
  await ensureOgcodePublishingSchema();
  const result = await pool().query(
    `UPDATE content.ogcode_publications
     SET status = 'approved',
         admin_reviewed_by = $3,
         admin_reviewed_at = NOW(),
         admin_notes = $4,
         updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2 AND status = 'pending_review'
     RETURNING *`,
    [input.publicationId, input.workspaceId, input.adminUserId, input.notes ?? null],
  );
  return result.rows[0] ? rowToPublication(result.rows[0]) : null;
}

export async function rejectPublication(input: {
  workspaceId: string;
  publicationId: string;
  adminUserId: string;
  notes?: string | null;
}): Promise<OgcodePublication | null> {
  await ensureOgcodePublishingSchema();
  const result = await pool().query(
    `UPDATE content.ogcode_publications
     SET status = 'rejected',
         admin_reviewed_by = $3,
         admin_reviewed_at = NOW(),
         admin_notes = $4,
         rejected_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2 AND status = 'pending_review'
     RETURNING *`,
    [input.publicationId, input.workspaceId, input.adminUserId, input.notes ?? null],
  );
  return result.rows[0] ? rowToPublication(result.rows[0]) : null;
}

export async function publishPublication(input: {
  workspaceId: string;
  publicationId: string;
  adminUserId: string;
}): Promise<OgcodePublication | null> {
  await ensureOgcodePublishingSchema();
  const result = await pool().query(
    `UPDATE content.ogcode_publications
     SET status = 'published',
         admin_reviewed_by = $3,
         admin_reviewed_at = NOW(),
         published_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2 AND status IN ('pending_review', 'approved')
     RETURNING *`,
    [input.publicationId, input.workspaceId, input.adminUserId],
  );
  return result.rows[0] ? rowToPublication(result.rows[0]) : null;
}

export async function supersedePublication(input: {
  workspaceId: string;
  originalPublicationId: string;
  newPublicationId: string;
}): Promise<OgcodePublication | null> {
  await ensureOgcodePublishingSchema();
  const result = await pool().query(
    `UPDATE content.ogcode_publications
     SET status = 'superseded',
         superseded_by = $3,
         updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2 AND status IN ('published', 'approved')
     RETURNING *`,
    [input.originalPublicationId, input.workspaceId, input.newPublicationId],
  );
  return result.rows[0] ? rowToPublication(result.rows[0]) : null;
}

export async function createRepublishVersion(input: {
  workspaceId: string;
  originalPublicationId: string;
  ogcodeQuestionId: string;
  questionBagQuestionId?: string | null;
  submittedBy: string;
  hintProvided: boolean;
  fullSolutionProvided: boolean;
  metadata?: Record<string, unknown>;
}): Promise<{ newPublication: OgcodePublication; superseded: OgcodePublication | null }> {
  const newPublication = await createOgcodePublication({
    workspaceId: input.workspaceId,
    ogcodeQuestionId: input.ogcodeQuestionId,
    questionBagQuestionId: input.questionBagQuestionId,
    submittedBy: input.submittedBy,
    hintProvided: input.hintProvided,
    fullSolutionProvided: input.fullSolutionProvided,
    metadata: input.metadata,
  });

  const superseded = await supersedePublication({
    workspaceId: input.workspaceId,
    originalPublicationId: input.originalPublicationId,
    newPublicationId: newPublication.id,
  });

  return { newPublication, superseded };
}

export async function getPublicationByOgcodeQuestion(
  ogcodeQuestionId: string,
): Promise<OgcodePublication | null> {
  await ensureOgcodePublishingSchema();
  const result = await pool().query(
    `SELECT * FROM content.ogcode_publications
     WHERE ogcode_question_id = $1 AND status = 'published'
     ORDER BY version DESC
     LIMIT 1`,
    [ogcodeQuestionId],
  );
  return result.rows[0] ? rowToPublication(result.rows[0]) : null;
}

export function validatePublicationRequirements(input: {
  ogcodeQuestionId: string;
  hintProvided: boolean;
  fullSolutionProvided: boolean;
}): { valid: boolean; missingRequirements: string[] } {
  const missing: string[] = [];
  if (!input.hintProvided) {
    missing.push("hint");
  }
  if (!input.fullSolutionProvided) {
    missing.push("full_solution");
  }
  return {
    valid: missing.length === 0,
    missingRequirements: missing,
  };
}
