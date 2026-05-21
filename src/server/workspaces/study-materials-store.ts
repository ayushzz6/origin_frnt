/**
 * Postgres-backed store for study materials (Phase 7).
 */

import type { Pool } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";

import {
  createStudyMaterialAssignmentId,
  createStudyMaterialAssetId,
  createStudyMaterialId,
} from "./ids";
import { ensureStudyMaterialsSchema } from "./study-materials-schema";
import type {
  StudyMaterial,
  StudyMaterialAsset,
  StudyMaterialAssignment,
  StudyMaterialAssignmentTarget,
  StudyMaterialStatus,
  StudyMaterialType,
  StudyMaterialWithAssets,
} from "./types";

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function rowToMaterial(row: Record<string, unknown>): StudyMaterial {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    materialType: row.material_type as StudyMaterialType,
    subject: (row.subject as string | null) ?? null,
    topic: (row.topic as string | null) ?? null,
    classLevel: (row.class_level as string | null) ?? null,
    status: row.status as StudyMaterialStatus,
    createdBy: row.created_by as string,
    publishedAt: row.published_at ? new Date(row.published_at as string).toISOString() : null,
    archivedAt: row.archived_at ? new Date(row.archived_at as string).toISOString() : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

function rowToAsset(row: Record<string, unknown>): StudyMaterialAsset {
  return {
    id: row.id as string,
    materialId: row.material_id as string,
    r2ObjectKey: row.r2_object_key as string,
    r2Bucket: row.r2_bucket as string,
    publicUrl: row.public_url as string,
    mimeType: row.mime_type as string,
    sizeBytes: row.size_bytes as number,
    sha256: row.sha256 as string,
    displayName: (row.display_name as string | null) ?? null,
    sortOrder: row.sort_order as number,
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

function rowToAssignment(row: Record<string, unknown>): StudyMaterialAssignment {
  return {
    id: row.id as string,
    materialId: row.material_id as string,
    workspaceId: row.workspace_id as string,
    targetType: row.target_type as StudyMaterialAssignmentTarget,
    targetId: row.target_id as string,
    assignedBy: (row.assigned_by as string | null) ?? null,
    assignedAt: new Date(row.assigned_at as string).toISOString(),
    revokedAt: row.revoked_at ? new Date(row.revoked_at as string).toISOString() : null,
  };
}

export type CreateStudyMaterialInput = {
  workspaceId: string;
  title: string;
  description?: string | null;
  materialType?: StudyMaterialType;
  subject?: string | null;
  topic?: string | null;
  classLevel?: string | null;
  createdBy: string;
  metadata?: Record<string, unknown>;
};

export async function createStudyMaterial(input: CreateStudyMaterialInput): Promise<StudyMaterial> {
  await ensureStudyMaterialsSchema();
  const id = createStudyMaterialId();
  const result = await pool().query(
    `INSERT INTO content.study_materials (
       id, workspace_id, title, description, material_type, subject, topic, class_level, created_by, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
     RETURNING *`,
    [
      id,
      input.workspaceId,
      input.title,
      input.description ?? null,
      input.materialType ?? "pdf",
      input.subject ?? null,
      input.topic ?? null,
      input.classLevel ?? null,
      input.createdBy,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return rowToMaterial(result.rows[0]);
}

export async function getStudyMaterial(
  workspaceId: string,
  materialId: string,
): Promise<StudyMaterial | null> {
  await ensureStudyMaterialsSchema();
  const result = await pool().query(
    `SELECT * FROM content.study_materials WHERE id = $1 AND workspace_id = $2`,
    [materialId, workspaceId],
  );
  return result.rows[0] ? rowToMaterial(result.rows[0]) : null;
}

export async function listStudyMaterials(
  workspaceId: string,
  filter?: { status?: StudyMaterialStatus | "all"; subject?: string },
): Promise<StudyMaterialWithAssets[]> {
  await ensureStudyMaterialsSchema();
  const params: unknown[] = [workspaceId];
  let where = "m.workspace_id = $1";
  if (filter?.status && filter.status !== "all") {
    params.push(filter.status);
    where += ` AND m.status = $${params.length}`;
  }
  if (filter?.subject) {
    params.push(filter.subject);
    where += ` AND m.subject = $${params.length}`;
  }
  const result = await pool().query(
    `SELECT m.*,
            COALESCE(json_agg(a.* ORDER BY a.sort_order) FILTER (WHERE a.id IS NOT NULL), '[]'::json) AS assets,
            COUNT(a.id)::int AS asset_count
     FROM content.study_materials m
     LEFT JOIN content.study_material_assets a ON a.material_id = m.id
     WHERE ${where}
     GROUP BY m.id
     ORDER BY m.created_at DESC`,
    params,
  );
  return result.rows.map((row) => ({
    ...rowToMaterial(row),
    assets: (row.assets as Record<string, unknown>[]).map(rowToAsset),
    assetCount: Number(row.asset_count) || 0,
  }));
}

export type UpdateStudyMaterialInput = Partial<{
  title: string;
  description: string | null;
  materialType: StudyMaterialType;
  subject: string | null;
  topic: string | null;
  classLevel: string | null;
  metadata: Record<string, unknown>;
}>;

export async function updateStudyMaterial(
  workspaceId: string,
  materialId: string,
  patch: UpdateStudyMaterialInput,
): Promise<StudyMaterial | null> {
  await ensureStudyMaterialsSchema();
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  const column: Record<keyof UpdateStudyMaterialInput, string> = {
    title: "title",
    description: "description",
    materialType: "material_type",
    subject: "subject",
    topic: "topic",
    classLevel: "class_level",
    metadata: "metadata",
  };
  for (const key of Object.keys(patch) as (keyof UpdateStudyMaterialInput)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    if (key === "metadata") {
      fields.push(`${column[key]} = $${i++}::jsonb`);
      values.push(JSON.stringify(value));
    } else {
      fields.push(`${column[key]} = $${i++}`);
      values.push(value);
    }
  }
  if (fields.length === 0) {
    return getStudyMaterial(workspaceId, materialId);
  }
  values.push(materialId, workspaceId);
  const result = await pool().query(
    `UPDATE content.study_materials
     SET ${fields.join(", ")}, updated_at = NOW()
     WHERE id = $${i++} AND workspace_id = $${i}
     RETURNING *`,
    values,
  );
  return result.rows[0] ? rowToMaterial(result.rows[0]) : null;
}

export async function publishStudyMaterial(
  workspaceId: string,
  materialId: string,
): Promise<StudyMaterial | null> {
  await ensureStudyMaterialsSchema();
  const result = await pool().query(
    `UPDATE content.study_materials
     SET status = 'published', published_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2 AND status = 'draft'
     RETURNING *`,
    [materialId, workspaceId],
  );
  return result.rows[0] ? rowToMaterial(result.rows[0]) : null;
}

export async function archiveStudyMaterial(
  workspaceId: string,
  materialId: string,
): Promise<StudyMaterial | null> {
  await ensureStudyMaterialsSchema();
  const result = await pool().query(
    `UPDATE content.study_materials
     SET status = 'archived', archived_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2 AND status = 'published'
     RETURNING *`,
    [materialId, workspaceId],
  );
  return result.rows[0] ? rowToMaterial(result.rows[0]) : null;
}

export async function deleteStudyMaterial(
  workspaceId: string,
  materialId: string,
): Promise<boolean> {
  await ensureStudyMaterialsSchema();
  const result = await pool().query(
    `DELETE FROM content.study_materials WHERE id = $1 AND workspace_id = $2`,
    [materialId, workspaceId],
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Assets ───────────────────────────────────────────────────────────────────

export async function addStudyMaterialAsset(input: {
  materialId: string;
  r2ObjectKey: string;
  r2Bucket: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  displayName?: string | null;
  sortOrder?: number;
}): Promise<StudyMaterialAsset> {
  await ensureStudyMaterialsSchema();
  const id = createStudyMaterialAssetId();
  const result = await pool().query(
    `INSERT INTO content.study_material_assets (
       id, material_id, r2_object_key, r2_bucket, public_url, mime_type, size_bytes, sha256, display_name, sort_order
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      id,
      input.materialId,
      input.r2ObjectKey,
      input.r2Bucket,
      input.publicUrl,
      input.mimeType,
      input.sizeBytes,
      input.sha256,
      input.displayName ?? null,
      input.sortOrder ?? 0,
    ],
  );
  return rowToAsset(result.rows[0]);
}

export async function listMaterialAssets(materialId: string): Promise<StudyMaterialAsset[]> {
  await ensureStudyMaterialsSchema();
  const result = await pool().query(
    `SELECT * FROM content.study_material_assets WHERE material_id = $1 ORDER BY sort_order ASC`,
    [materialId],
  );
  return result.rows.map(rowToAsset);
}

export async function removeStudyMaterialAsset(
  materialId: string,
  assetId: string,
): Promise<boolean> {
  await ensureStudyMaterialsSchema();
  const result = await pool().query(
    `DELETE FROM content.study_material_assets WHERE id = $1 AND material_id = $2`,
    [assetId, materialId],
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Assignments ──────────────────────────────────────────────────────────────

export async function assignStudyMaterial(input: {
  materialId: string;
  workspaceId: string;
  targetType: StudyMaterialAssignmentTarget;
  targetId: string;
  assignedBy: string;
}): Promise<StudyMaterialAssignment> {
  await ensureStudyMaterialsSchema();
  const id = createStudyMaterialAssignmentId();
  const result = await pool().query(
    `INSERT INTO content.study_material_assignments (
       id, material_id, workspace_id, target_type, target_id, assigned_by
     ) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (material_id, target_type, target_id)
     DO UPDATE SET revoked_at = NULL, assigned_at = NOW()
     RETURNING *`,
    [id, input.materialId, input.workspaceId, input.targetType, input.targetId, input.assignedBy],
  );
  return rowToAssignment(result.rows[0]);
}

export async function revokeMaterialAssignment(
  materialId: string,
  targetType: StudyMaterialAssignmentTarget,
  targetId: string,
): Promise<boolean> {
  await ensureStudyMaterialsSchema();
  const result = await pool().query(
    `UPDATE content.study_material_assignments
     SET revoked_at = NOW()
     WHERE material_id = $1 AND target_type = $2 AND target_id = $3 AND revoked_at IS NULL
     RETURNING id`,
    [materialId, targetType, targetId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listMaterialAssignments(materialId: string): Promise<StudyMaterialAssignment[]> {
  await ensureStudyMaterialsSchema();
  const result = await pool().query(
    `SELECT * FROM content.study_material_assignments WHERE material_id = $1 AND revoked_at IS NULL ORDER BY assigned_at DESC`,
    [materialId],
  );
  return result.rows.map(rowToAssignment);
}

export async function getMaterialsForBatch(
  workspaceId: string,
  batchId: string,
): Promise<StudyMaterialWithAssets[]> {
  await ensureStudyMaterialsSchema();
  const result = await pool().query(
    `SELECT m.*,
            COALESCE(json_agg(a.* ORDER BY a.sort_order) FILTER (WHERE a.id IS NOT NULL), '[]'::json) AS assets,
            COUNT(a.id)::int AS asset_count
     FROM content.study_materials m
     INNER JOIN content.study_material_assignments asn ON asn.material_id = m.id
     LEFT JOIN content.study_material_assets a ON a.material_id = m.id
     WHERE m.workspace_id = $1
       AND m.status = 'published'
       AND asn.target_type = 'batch'
       AND asn.target_id = $2
       AND asn.revoked_at IS NULL
     GROUP BY m.id
     ORDER BY m.created_at DESC`,
    [workspaceId, batchId],
  );
  return result.rows.map((row) => ({
    ...rowToMaterial(row),
    assets: (row.assets as Record<string, unknown>[]).map(rowToAsset),
    assetCount: Number(row.asset_count) || 0,
  }));
}

export async function getMaterialsForStudent(
  workspaceId: string,
  studentId: string,
): Promise<StudyMaterialWithAssets[]> {
  await ensureStudyMaterialsSchema();
  const result = await pool().query(
    `SELECT m.*,
            COALESCE(json_agg(a.* ORDER BY a.sort_order) FILTER (WHERE a.id IS NOT NULL), '[]'::json) AS assets,
            COUNT(a.id)::int AS asset_count
     FROM content.study_materials m
     INNER JOIN content.study_material_assignments asn ON asn.material_id = m.id
     LEFT JOIN content.study_material_assets a ON a.material_id = m.id
     WHERE m.workspace_id = $1
       AND m.status = 'published'
       AND (
         (asn.target_type = 'student' AND asn.target_id = $2)
         OR (asn.target_type = 'workspace' AND asn.target_id = $1)
         OR (asn.target_type = 'batch' AND asn.target_id IN (
           SELECT batch_id FROM app.batch_members
           WHERE workspace_id = $1 AND student_id = $2 AND status = 'active'
         ))
       )
       AND asn.revoked_at IS NULL
     GROUP BY m.id
     ORDER BY m.created_at DESC`,
    [workspaceId, studentId],
  );
  return result.rows.map((row) => ({
    ...rowToMaterial(row),
    assets: (row.assets as Record<string, unknown>[]).map(rowToAsset),
    assetCount: Number(row.asset_count) || 0,
  }));
}
