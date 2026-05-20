/**
 * Question Bag store: assets, questions, question versions, and asset links.
 *
 * Every question edit creates a new version row. The parent question's
 * current_version_id points to the latest version.
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureContentSchema } from "./content-schema";
import {
  createAssetId,
  createQuestionId,
  createQuestionVersionId,
} from "./ids";
import type {
  Asset,
  AssetKind,
  AssetOwnerType,
  Question,
  QuestionAssetLink,
  QuestionAssetPurpose,
  QuestionFilter,
  QuestionOption,
  QuestionStatus,
  QuestionType,
  QuestionVersion,
  QuestionWithVersion,
} from "./types";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function rowToAsset(row: Record<string, unknown>): Asset {
  return {
    id: row.id as string,
    ownerType: row.owner_type as AssetOwnerType,
    ownerWorkspaceId: (row.owner_workspace_id as string | null) ?? null,
    ownerUserId: (row.owner_user_id as string | null) ?? null,
    kind: row.kind as AssetKind,
    mimeType: row.mime_type as string,
    fileName: row.file_name as string,
    byteSize: Number(row.byte_size) || 0,
    sha256: row.sha256 as string,
    r2Bucket: row.r2_bucket as string,
    r2ObjectKey: row.r2_object_key as string,
    publicUrl: (row.public_url as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

function rowToQuestion(row: Record<string, unknown>): Question {
  return {
    id: row.id as string,
    ownerScope: row.owner_scope as "platform" | "workspace",
    workspaceId: (row.workspace_id as string | null) ?? null,
    createdBy: row.created_by as string,
    currentVersionId: (row.current_version_id as string | null) ?? null,
    visibility: row.visibility as "private" | "workspace" | "public_ogcode",
    status: row.status as QuestionStatus,
    sourceKind: row.source_kind as string,
    importedJobId: (row.imported_job_id as string | null) ?? null,
    externalSourceId: (row.external_source_id as string | null) ?? null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

function rowToVersion(row: Record<string, unknown>): QuestionVersion {
  return {
    id: row.id as string,
    questionId: row.question_id as string,
    versionNumber: Number(row.version_number) || 1,
    questionType: row.question_type as QuestionType,
    stem: row.stem as string,
    options: (row.options as QuestionOption[] | null) ?? null,
    correctOption: (row.correct_option as number | null) ?? null,
    correctOptions: (row.correct_options as number[] | null) ?? null,
    answerText: (row.answer_text as string | null) ?? null,
    answerSpec: (row.answer_spec as Record<string, unknown> | null) ?? null,
    matrixData: (row.matrix_data as Record<string, unknown> | null) ?? null,
    hint: (row.hint as string | null) ?? null,
    explanation: (row.explanation as string | null) ?? null,
    fullSolution: (row.full_solution as string | null) ?? null,
    subject: row.subject as string,
    chapter: row.chapter as string,
    concept: row.concept as string,
    difficulty: row.difficulty as "easy" | "medium" | "hard" | "insane",
    tags: (row.tags as string[]) ?? [],
    importEvidence: (row.import_evidence as Record<string, unknown>) ?? {},
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdBy: row.created_by as string,
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

// ─── Assets ───────────────────────────────────────────────────────────────────

export type CreateAssetInput = {
  ownerType: AssetOwnerType;
  ownerWorkspaceId?: string | null;
  ownerUserId?: string | null;
  kind: AssetKind;
  mimeType: string;
  fileName: string;
  byteSize: number;
  sha256: string;
  r2Bucket: string;
  r2ObjectKey: string;
  publicUrl?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
};

export async function createAsset(input: CreateAssetInput): Promise<Asset> {
  await ensureContentSchema();
  const id = createAssetId();
  const result = await pool().query(
    `INSERT INTO content.assets (
       id, owner_type, owner_workspace_id, owner_user_id, kind, mime_type,
       file_name, byte_size, sha256, r2_bucket, r2_object_key, public_url, metadata, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14)
     RETURNING *`,
    [
      id,
      input.ownerType,
      input.ownerWorkspaceId ?? null,
      input.ownerUserId ?? null,
      input.kind,
      input.mimeType,
      input.fileName,
      input.byteSize,
      input.sha256,
      input.r2Bucket,
      input.r2ObjectKey,
      input.publicUrl ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.createdBy ?? null,
    ],
  );
  return rowToAsset(result.rows[0]);
}

export async function getAssetById(assetId: string): Promise<Asset | null> {
  await ensureContentSchema();
  const result = await pool().query(
    `SELECT * FROM content.assets WHERE id = $1`,
    [assetId],
  );
  return result.rows[0] ? rowToAsset(result.rows[0]) : null;
}

// ─── Questions ────────────────────────────────────────────────────────────────

export type CreateQuestionInput = {
  workspaceId: string;
  createdBy: string;
  visibility?: "private" | "workspace";
  sourceKind?: string;
  importedJobId?: string | null;
  externalSourceId?: string | null;
};

export async function createQuestion(input: CreateQuestionInput): Promise<Question> {
  await ensureContentSchema();
  const id = createQuestionId();
  const result = await pool().query(
    `INSERT INTO content.questions (
       id, owner_scope, workspace_id, created_by, visibility,
       source_kind, imported_job_id, external_source_id
     ) VALUES ($1,'workspace',$2,$3,'private',$4,$5,$6)
     RETURNING *`,
    [
      id,
      input.workspaceId,
      input.createdBy,
      input.sourceKind ?? "manual",
      input.importedJobId ?? null,
      input.externalSourceId ?? null,
    ],
  );
  return rowToQuestion(result.rows[0]);
}

export async function getQuestionById(questionId: string): Promise<Question | null> {
  await ensureContentSchema();
  const result = await pool().query(
    `SELECT * FROM content.questions WHERE id = $1`,
    [questionId],
  );
  return result.rows[0] ? rowToQuestion(result.rows[0]) : null;
}

export async function getQuestionWithVersion(questionId: string): Promise<QuestionWithVersion | null> {
  await ensureContentSchema();
  const question = await getQuestionById(questionId);
  if (!question) return null;

  let currentVersion: QuestionVersion | null = null;
  if (question.currentVersionId) {
    const vr = await pool().query(
      `SELECT * FROM content.question_versions WHERE id = $1`,
      [question.currentVersionId],
    );
    if (vr.rows[0]) {
      currentVersion = rowToVersion(vr.rows[0]);
    }
  }

  const assetRows = await pool().query(
    `SELECT a.*, qal.purpose, qal.display_order, qal.metadata AS link_metadata
     FROM content.question_asset_links qal
     INNER JOIN content.assets a ON a.id = qal.asset_id
     WHERE qal.question_version_id = $1
     ORDER BY qal.display_order ASC`,
    [question.currentVersionId ?? "NONE"],
  );

  const assetLinks: (QuestionAssetLink & { asset: Asset })[] = assetRows.rows.map((r) => ({
    questionVersionId: r.question_version_id as string,
    assetId: r.asset_id as string,
    purpose: r.purpose as QuestionAssetPurpose,
    displayOrder: Number(r.display_order) || 0,
    metadata: (r.link_metadata as Record<string, unknown>) ?? {},
    asset: rowToAsset(r),
  }));

  return { ...question, currentVersion, assetLinks };
}

export type UpdateQuestionInput = {
  status?: QuestionStatus;
  visibility?: "private" | "workspace" | "public_ogcode";
};

export async function updateQuestion(
  questionId: string,
  patch: UpdateQuestionInput,
): Promise<Question | null> {
  await ensureContentSchema();
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (patch.status !== undefined) {
    fields.push(`status = $${i++}`);
    params.push(patch.status);
  }
  if (patch.visibility !== undefined) {
    fields.push(`visibility = $${i++}`);
    params.push(patch.visibility);
  }
  if (fields.length === 0) return getQuestionById(questionId);
  fields.push("updated_at = NOW()");
  params.push(questionId);
  const result = await pool().query(
    `UPDATE content.questions
     SET ${fields.join(", ")}
     WHERE id = $${i}
     RETURNING *`,
    params,
  );
  return result.rows[0] ? rowToQuestion(result.rows[0]) : null;
}

export async function listQuestions(
  workspaceId: string,
  filter?: QuestionFilter,
): Promise<QuestionWithVersion[]> {
  await ensureContentSchema();
  const params: unknown[] = [workspaceId];
  let i = 1;
  let where = `q.workspace_id = $${i++}`;
  if (filter?.status && filter.status !== "all") {
    params.push(filter.status);
    where += ` AND q.status = $${i++}`;
  }
  if (filter?.subject) {
    params.push(filter.subject);
    where += ` AND v.subject = $${i++}`;
  }
  if (filter?.chapter) {
    params.push(filter.chapter);
    where += ` AND v.chapter = $${i++}`;
  }
  if (filter?.difficulty) {
    params.push(filter.difficulty);
    where += ` AND v.difficulty = $${i++}`;
  }
  if (filter?.questionType) {
    params.push(filter.questionType);
    where += ` AND v.question_type = $${i++}`;
  }
  if (filter?.search) {
    params.push(`%${filter.search}%`);
    where += ` AND v.stem ILIKE $${i++}`;
  }

  const result = await pool().query(
    `SELECT q.*, v.id AS ver_id, v.question_id AS ver_qid, v.version_number,
            v.question_type, v.stem, v.options, v.correct_option, v.correct_options,
            v.answer_text, v.answer_spec, v.matrix_data, v.hint, v.explanation,
            v.full_solution, v.subject, v.chapter, v.concept, v.difficulty,
            v.tags, v.import_evidence, v.metadata AS ver_metadata, v.created_by AS ver_created_by,
            v.created_at AS ver_created_at
     FROM content.questions q
     LEFT JOIN content.question_versions v ON v.id = q.current_version_id
     WHERE ${where}
     ORDER BY q.updated_at DESC`,
    params,
  );

  const questions: QuestionWithVersion[] = [];
  for (const row of result.rows) {
    const question = rowToQuestion(row);
    let version: QuestionVersion | null = null;
    if (row.ver_id) {
      version = {
        id: row.ver_id as string,
        questionId: row.ver_qid as string,
        versionNumber: Number(row.version_number) || 1,
        questionType: row.question_type as QuestionType,
        stem: row.stem as string,
        options: (row.options as QuestionOption[] | null) ?? null,
        correctOption: (row.correct_option as number | null) ?? null,
        correctOptions: (row.correct_options as number[] | null) ?? null,
        answerText: (row.answer_text as string | null) ?? null,
        answerSpec: (row.answer_spec as Record<string, unknown> | null) ?? null,
        matrixData: (row.matrix_data as Record<string, unknown> | null) ?? null,
        hint: (row.hint as string | null) ?? null,
        explanation: (row.explanation as string | null) ?? null,
        fullSolution: (row.full_solution as string | null) ?? null,
        subject: row.subject as string,
        chapter: row.chapter as string,
        concept: row.concept as string,
        difficulty: row.difficulty as "easy" | "medium" | "hard" | "insane",
        tags: (row.tags as string[]) ?? [],
        importEvidence: (row.import_evidence as Record<string, unknown>) ?? {},
        metadata: (row.ver_metadata as Record<string, unknown>) ?? {},
        createdBy: row.ver_created_by as string,
        createdAt: new Date(row.ver_created_at as string).toISOString(),
      };
    }
    const assetRows = await pool().query(
      `SELECT a.*, qal.purpose, qal.display_order, qal.metadata AS link_metadata
       FROM content.question_asset_links qal
       INNER JOIN content.assets a ON a.id = qal.asset_id
       WHERE qal.question_version_id = $1
       ORDER BY qal.display_order ASC`,
      [question.currentVersionId ?? "NONE"],
    );
    const assetLinks: (QuestionAssetLink & { asset: Asset })[] = assetRows.rows.map((r) => ({
      questionVersionId: r.question_version_id as string,
      assetId: r.asset_id as string,
      purpose: r.purpose as QuestionAssetPurpose,
      displayOrder: Number(r.display_order) || 0,
      metadata: (r.link_metadata as Record<string, unknown>) ?? {},
      asset: rowToAsset(r),
    }));
    questions.push({ ...question, currentVersion: version, assetLinks });
  }
  return questions;
}

// ─── Question Versions ───────────────────────────────────────────────────────

export type CreateVersionInput = {
  questionId: string;
  createdBy: string;
  questionType: QuestionType;
  stem: string;
  options?: QuestionOption[] | null;
  correctOption?: number | null;
  correctOptions?: number[] | null;
  answerText?: string | null;
  answerSpec?: Record<string, unknown> | null;
  matrixData?: Record<string, unknown> | null;
  hint?: string | null;
  explanation?: string | null;
  fullSolution?: string | null;
  subject: string;
  chapter: string;
  concept: string;
  difficulty: "easy" | "medium" | "hard" | "insane";
  tags?: string[];
  importEvidence?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export async function createVersion(input: CreateVersionInput): Promise<QuestionVersion> {
  await ensureContentSchema();
  const id = createQuestionVersionId();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const maxVer = await client.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_ver
       FROM content.question_versions WHERE question_id = $1`,
      [input.questionId],
    );
    const nextVer = Number(maxVer.rows[0].next_ver) || 1;
    const result = await client.query(
      `INSERT INTO content.question_versions (
         id, question_id, version_number, question_type, stem, options,
         correct_option, correct_options, answer_text, answer_spec, matrix_data,
         hint, explanation, full_solution, subject, chapter, concept, difficulty,
         tags, import_evidence, metadata, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21::jsonb,$22)
       RETURNING *`,
      [
        id,
        input.questionId,
        nextVer,
        input.questionType,
        input.stem,
        input.options ? JSON.stringify(input.options) : null,
        input.correctOption ?? null,
        input.correctOptions ? JSON.stringify(input.correctOptions) : null,
        input.answerText ?? null,
        input.answerSpec ? JSON.stringify(input.answerSpec) : null,
        input.matrixData ? JSON.stringify(input.matrixData) : null,
        input.hint ?? null,
        input.explanation ?? null,
        input.fullSolution ?? null,
        input.subject,
        input.chapter,
        input.concept,
        input.difficulty,
        input.tags ?? [],
        JSON.stringify(input.importEvidence ?? {}),
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
    );
    await client.query(
      `UPDATE content.questions
       SET current_version_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [id, input.questionId],
    );
    await client.query("COMMIT");
    return rowToVersion(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getVersionById(versionId: string): Promise<QuestionVersion | null> {
  await ensureContentSchema();
  const result = await pool().query(
    `SELECT * FROM content.question_versions WHERE id = $1`,
    [versionId],
  );
  return result.rows[0] ? rowToVersion(result.rows[0]) : null;
}

export async function listVersions(questionId: string): Promise<QuestionVersion[]> {
  await ensureContentSchema();
  const result = await pool().query(
    `SELECT * FROM content.question_versions
     WHERE question_id = $1
     ORDER BY version_number DESC`,
    [questionId],
  );
  return result.rows.map(rowToVersion);
}

export async function getVersionAssetLinks(versionId: string): Promise<(QuestionAssetLink & { asset: Asset })[]> {
  await ensureContentSchema();
  const result = await pool().query(
    `SELECT a.*, qal.purpose, qal.display_order, qal.metadata AS link_metadata
     FROM content.question_asset_links qal
     INNER JOIN content.assets a ON a.id = qal.asset_id
     WHERE qal.question_version_id = $1
     ORDER BY qal.display_order ASC`,
    [versionId],
  );
  return result.rows.map((r) => ({
    questionVersionId: r.question_version_id as string,
    assetId: r.asset_id as string,
    purpose: r.purpose as QuestionAssetPurpose,
    displayOrder: Number(r.display_order) || 0,
    metadata: (r.link_metadata as Record<string, unknown>) ?? {},
    asset: rowToAsset(r),
  }));
}

// ─── Asset Links ──────────────────────────────────────────────────────────────

export async function linkAssetToVersion(input: {
  questionVersionId: string;
  assetId: string;
  purpose: QuestionAssetPurpose;
  displayOrder?: number;
  metadata?: Record<string, unknown>;
}): Promise<QuestionAssetLink> {
  await ensureContentSchema();
  await pool().query(
    `INSERT INTO content.question_asset_links (
       question_version_id, asset_id, purpose, display_order, metadata
     ) VALUES ($1,$2,$3,$4,$5::jsonb)
     ON CONFLICT (question_version_id, asset_id, purpose) DO NOTHING`,
    [
      input.questionVersionId,
      input.assetId,
      input.purpose,
      input.displayOrder ?? 0,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  const result = await pool().query(
    `SELECT * FROM content.question_asset_links
     WHERE question_version_id = $1 AND asset_id = $2 AND purpose = $3`,
    [input.questionVersionId, input.assetId, input.purpose],
  );
  return {
    questionVersionId: result.rows[0].question_version_id as string,
    assetId: result.rows[0].asset_id as string,
    purpose: result.rows[0].purpose as QuestionAssetPurpose,
    displayOrder: Number(result.rows[0].display_order) || 0,
    metadata: (result.rows[0].metadata as Record<string, unknown>) ?? {},
  };
}

export async function unlinkAsset(input: {
  questionVersionId: string;
  assetId: string;
  purpose: QuestionAssetPurpose;
}): Promise<boolean> {
  await ensureContentSchema();
  const result = await pool().query(
    `DELETE FROM content.question_asset_links
     WHERE question_version_id = $1 AND asset_id = $2 AND purpose = $3`,
    [input.questionVersionId, input.assetId, input.purpose],
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Convenience helpers ─────────────────────────────────────────────────────

export async function getReadyQuestionCount(workspaceId: string): Promise<number> {
  await ensureContentSchema();
  const result = await pool().query(
    `SELECT COUNT(*) AS cnt FROM content.questions
     WHERE workspace_id = $1 AND status = 'ready'`,
    [workspaceId],
  );
  return Number(result.rows[0].cnt) || 0;
}