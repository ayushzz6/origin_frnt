/**
 * Postgres-backed store for OGCode publishing (Phase 9).
 * Aligned to V1/teacher-admin-launch-plan/02-database-schema-design.md.
 *
 * Lifecycle (status enum, content.ogcode_publication_status):
 *   draft → submitted → (approved|changes_requested|rejected)
 *           approved  → published
 *           published → archived (via supersede chain on republish)
 *
 * The "is hint/full_solution present" gate lives in the service layer
 * — it inspects the linked content.question_versions row at submit time
 * rather than trusting caller-supplied booleans.
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
    questionId: row.question_id as string,
    questionVersionId: row.question_version_id as string,
    contributorWorkspaceId: (row.contributor_workspace_id as string | null) ?? null,
    contributorUserId: (row.contributor_user_id as string | null) ?? null,
    attributionName: row.attribution_name as string,
    attributionLogoAssetId: (row.attribution_logo_asset_id as string | null) ?? null,
    status: row.status as OgcodePublicationStatus,
    version: Number(row.version ?? 1),
    moderationNotes: (row.moderation_notes as string | null) ?? null,
    submittedAt: row.submitted_at ? new Date(row.submitted_at as string).toISOString() : null,
    reviewedBy: (row.reviewed_by as string | null) ?? null,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at as string).toISOString() : null,
    publishedAt: row.published_at ? new Date(row.published_at as string).toISOString() : null,
    archivedAt: row.archived_at ? new Date(row.archived_at as string).toISOString() : null,
    supersededBy: (row.superseded_by as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export type CreateOgcodePublicationInput = {
  questionId: string;
  questionVersionId: string;
  contributorWorkspaceId?: string | null;
  contributorUserId?: string | null;
  attributionName: string;
  attributionLogoAssetId?: string | null;
  status?: OgcodePublicationStatus; // defaults to 'draft'
  version?: number;
  metadata?: Record<string, unknown>;
};

export async function createOgcodePublication(input: CreateOgcodePublicationInput): Promise<OgcodePublication> {
  await ensureOgcodePublishingSchema();
  const id = createOgcodePublicationId();
  const result = await pool().query(
    `INSERT INTO content.ogcode_publications (
       id, question_id, question_version_id,
       contributor_workspace_id, contributor_user_id,
       attribution_name, attribution_logo_asset_id,
       status, version, metadata,
       submitted_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,
       CASE WHEN $8::content.ogcode_publication_status = 'submitted' THEN NOW() ELSE NULL END)
     RETURNING *`,
    [
      id,
      input.questionId,
      input.questionVersionId,
      input.contributorWorkspaceId ?? null,
      input.contributorUserId ?? null,
      input.attributionName,
      input.attributionLogoAssetId ?? null,
      input.status ?? "draft",
      input.version ?? 1,
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
    `SELECT * FROM content.ogcode_publications
     WHERE id = $1 AND contributor_workspace_id = $2`,
    [publicationId, workspaceId],
  );
  return result.rows[0] ? rowToPublication(result.rows[0]) : null;
}

export async function listOgcodePublications(
  workspaceId: string,
  filter?: { status?: OgcodePublicationStatus | "all"; contributorUserId?: string },
): Promise<OgcodePublication[]> {
  await ensureOgcodePublishingSchema();
  const params: unknown[] = [workspaceId];
  let where = "contributor_workspace_id = $1";
  if (filter?.status && filter.status !== "all") {
    params.push(filter.status);
    where += ` AND status = $${params.length}`;
  }
  if (filter?.contributorUserId) {
    params.push(filter.contributorUserId);
    where += ` AND contributor_user_id = $${params.length}`;
  }
  const result = await pool().query(
    `SELECT * FROM content.ogcode_publications
     WHERE ${where}
     ORDER BY created_at DESC`,
    params,
  );
  return result.rows.map(rowToPublication);
}

/**
 * Admin moderation queue. Returns publications in `submitted` state,
 * oldest first, joined to the question + current version for preview.
 */
export async function listSubmittedPublications(
  limit?: number,
): Promise<OgcodePublicationWithQuestion[]> {
  await ensureOgcodePublishingSchema();
  const maxLimit = limit ?? 50;
  const result = await pool().query(
    `SELECT p.*,
            qv.stem AS question_stem,
            qv.subject AS question_subject,
            qv.chapter AS question_chapter
     FROM content.ogcode_publications p
     LEFT JOIN content.question_versions qv ON qv.id = p.question_version_id
     WHERE p.status = 'submitted'
     ORDER BY p.submitted_at ASC NULLS LAST, p.created_at ASC
     LIMIT $1`,
    [maxLimit],
  );
  return result.rows.map((row) => ({
    ...rowToPublication(row),
    questionStem: (row.question_stem as string | null) ?? null,
    questionSubject: (row.question_subject as string | null) ?? null,
    questionChapter: (row.question_chapter as string | null) ?? null,
  }));
}

export async function submitForReview(input: {
  workspaceId: string;
  publicationId: string;
}): Promise<OgcodePublication | null> {
  await ensureOgcodePublishingSchema();
  const result = await pool().query(
    `UPDATE content.ogcode_publications
     SET status = 'submitted',
         submitted_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND contributor_workspace_id = $2 AND status IN ('draft', 'changes_requested')
     RETURNING *`,
    [input.publicationId, input.workspaceId],
  );
  return result.rows[0] ? rowToPublication(result.rows[0]) : null;
}

export async function approvePublication(input: {
  publicationId: string;
  reviewerUserId: string;
  notes?: string | null;
}): Promise<OgcodePublication | null> {
  await ensureOgcodePublishingSchema();
  const result = await pool().query(
    `UPDATE content.ogcode_publications
     SET status = 'approved',
         reviewed_by = $2,
         reviewed_at = NOW(),
         moderation_notes = $3,
         updated_at = NOW()
     WHERE id = $1 AND status = 'submitted'
     RETURNING *`,
    [input.publicationId, input.reviewerUserId, input.notes ?? null],
  );
  return result.rows[0] ? rowToPublication(result.rows[0]) : null;
}

export async function requestChanges(input: {
  publicationId: string;
  reviewerUserId: string;
  notes: string;
}): Promise<OgcodePublication | null> {
  await ensureOgcodePublishingSchema();
  const result = await pool().query(
    `UPDATE content.ogcode_publications
     SET status = 'changes_requested',
         reviewed_by = $2,
         reviewed_at = NOW(),
         moderation_notes = $3,
         updated_at = NOW()
     WHERE id = $1 AND status = 'submitted'
     RETURNING *`,
    [input.publicationId, input.reviewerUserId, input.notes],
  );
  return result.rows[0] ? rowToPublication(result.rows[0]) : null;
}

export async function rejectPublication(input: {
  publicationId: string;
  reviewerUserId: string;
  notes?: string | null;
}): Promise<OgcodePublication | null> {
  await ensureOgcodePublishingSchema();
  const result = await pool().query(
    `UPDATE content.ogcode_publications
     SET status = 'rejected',
         reviewed_by = $2,
         reviewed_at = NOW(),
         moderation_notes = $3,
         updated_at = NOW()
     WHERE id = $1 AND status = 'submitted'
     RETURNING *`,
    [input.publicationId, input.reviewerUserId, input.notes ?? null],
  );
  return result.rows[0] ? rowToPublication(result.rows[0]) : null;
}

export async function publishPublication(input: {
  publicationId: string;
  reviewerUserId: string;
}): Promise<OgcodePublication | null> {
  await ensureOgcodePublishingSchema();
  const result = await pool().query(
    `UPDATE content.ogcode_publications
     SET status = 'published',
         reviewed_by = COALESCE(reviewed_by, $2),
         reviewed_at = COALESCE(reviewed_at, NOW()),
         published_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND status IN ('approved', 'submitted')
     RETURNING *`,
    [input.publicationId, input.reviewerUserId],
  );
  return result.rows[0] ? rowToPublication(result.rows[0]) : null;
}

/**
 * Mark a previously-published publication as archived because a newer
 * version has taken its place. The supersede chain is tracked via
 * superseded_by, so consumers can walk from the latest back through
 * older versions for attempt-snapshot lookups.
 */
export async function archiveAsSuperseded(input: {
  originalPublicationId: string;
  newPublicationId: string;
}): Promise<OgcodePublication | null> {
  await ensureOgcodePublishingSchema();
  const result = await pool().query(
    `UPDATE content.ogcode_publications
     SET status = 'archived',
         superseded_by = $2,
         archived_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND status IN ('published', 'approved')
     RETURNING *`,
    [input.originalPublicationId, input.newPublicationId],
  );
  return result.rows[0] ? rowToPublication(result.rows[0]) : null;
}

/**
 * Returns the latest published row for a given question (the public
 * face of the OGCode contribution). Origin AI uses this to read the
 * stored full_solution before generation.
 */
export async function getPublishedPublicationForQuestion(
  questionId: string,
): Promise<OgcodePublication | null> {
  await ensureOgcodePublishingSchema();
  const result = await pool().query(
    `SELECT * FROM content.ogcode_publications
     WHERE question_id = $1 AND status = 'published'
     ORDER BY version DESC, published_at DESC
     LIMIT 1`,
    [questionId],
  );
  return result.rows[0] ? rowToPublication(result.rows[0]) : null;
}
