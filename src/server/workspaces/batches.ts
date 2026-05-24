/**
 * Batches and batch membership store.
 *
 * A student can belong to multiple batches in the same workspace; a workspace
 * member (staff) can be assigned to multiple batches as well.
 *
 * The student's workspace enrollment status is flipped to `active` once they
 * are placed into at least one batch.
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureEnrollmentSchema } from "./enrollment-schema";
import { setEnrollmentStatus } from "./enrollments";
import { createBatchId } from "./ids";
import type {
  Batch,
  BatchMember,
  BatchMemberStatus,
  BatchStatus,
  BatchWithCounts,
} from "./types";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function rowToBatch(row: Record<string, unknown>): Batch {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    name: row.name as string,
    course: (row.course as string | null) ?? null,
    subject: (row.subject as string | null) ?? null,
    classLevel: (row.class_level as string | null) ?? null,
    scheduleText: (row.schedule_text as string | null) ?? null,
    startsAt: row.starts_at ? new Date(row.starts_at as string).toISOString() : null,
    endsAt: row.ends_at ? new Date(row.ends_at as string).toISOString() : null,
    capacity: (row.capacity as number | null) ?? null,
    status: row.status as BatchStatus,
    settings: (row.settings as Record<string, unknown>) ?? {},
    createdBy: row.created_by as string,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

function rowToBatchMember(row: Record<string, unknown>): BatchMember {
  return {
    batchId: row.batch_id as string,
    workspaceId: row.workspace_id as string,
    studentId: row.student_id as string,
    status: row.status as BatchMemberStatus,
    assignedBy: (row.assigned_by as string | null) ?? null,
    assignedAt: new Date(row.assigned_at as string).toISOString(),
    removedAt: row.removed_at ? new Date(row.removed_at as string).toISOString() : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

export type CreateBatchInput = {
  workspaceId: string;
  name: string;
  course?: string | null;
  subject?: string | null;
  classLevel?: string | null;
  scheduleText?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  capacity?: number | null;
  status?: BatchStatus;
  settings?: Record<string, unknown>;
  createdBy: string;
};

export async function createBatch(input: CreateBatchInput): Promise<Batch> {
  await ensureEnrollmentSchema();
  const id = createBatchId();
  const result = await pool().query(
    `INSERT INTO app.batches (
       id, workspace_id, name, course, subject, class_level, schedule_text,
       starts_at, ends_at, capacity, status, settings, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)
     RETURNING *`,
    [
      id,
      input.workspaceId,
      input.name,
      input.course ?? null,
      input.subject ?? null,
      input.classLevel ?? null,
      input.scheduleText ?? null,
      input.startsAt ?? null,
      input.endsAt ?? null,
      input.capacity ?? null,
      input.status ?? "active",
      JSON.stringify(input.settings ?? {}),
      input.createdBy,
    ],
  );
  return rowToBatch(result.rows[0]);
}

export async function listBatches(
  workspaceId: string,
  filter?: { status?: BatchStatus | "all" },
): Promise<BatchWithCounts[]> {
  await ensureEnrollmentSchema();
  const params: unknown[] = [workspaceId];
  let where = "b.workspace_id = $1";
  if (filter?.status && filter.status !== "all") {
    params.push(filter.status);
    where += ` AND b.status = $${params.length}`;
  }
  const result = await pool().query(
    `SELECT b.*,
            COALESCE(COUNT(m.student_id) FILTER (WHERE m.status = 'active'), 0)::int AS student_count
     FROM app.batches b
     LEFT JOIN app.batch_members m ON m.batch_id = b.id
     WHERE ${where}
     GROUP BY b.id
     ORDER BY b.created_at DESC`,
    params,
  );
  return result.rows.map((row) => ({
    ...rowToBatch(row),
    studentCount: Number(row.student_count) || 0,
  }));
}

export async function getBatch(
  workspaceId: string,
  batchId: string,
): Promise<Batch | null> {
  await ensureEnrollmentSchema();
  const result = await pool().query(
    `SELECT * FROM app.batches WHERE id = $1 AND workspace_id = $2`,
    [batchId, workspaceId],
  );
  return result.rows[0] ? rowToBatch(result.rows[0]) : null;
}

export type UpdateBatchInput = Partial<Omit<CreateBatchInput, "workspaceId" | "createdBy">> & {
  status?: BatchStatus;
};

export async function updateBatch(
  workspaceId: string,
  batchId: string,
  patch: UpdateBatchInput,
): Promise<Batch | null> {
  await ensureEnrollmentSchema();
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  const map: Record<keyof UpdateBatchInput, string> = {
    name: "name",
    course: "course",
    subject: "subject",
    classLevel: "class_level",
    scheduleText: "schedule_text",
    startsAt: "starts_at",
    endsAt: "ends_at",
    capacity: "capacity",
    status: "status",
    settings: "settings",
  };
  for (const key of Object.keys(patch) as (keyof UpdateBatchInput)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    if (key === "settings") {
      fields.push(`${map[key]} = $${i++}::jsonb`);
      params.push(JSON.stringify(value));
    } else {
      fields.push(`${map[key]} = $${i++}`);
      params.push(value);
    }
  }
  if (fields.length === 0) {
    return getBatch(workspaceId, batchId);
  }
  params.push(batchId, workspaceId);
  const result = await pool().query(
    `UPDATE app.batches
     SET ${fields.join(", ")}, updated_at = NOW()
     WHERE id = $${i++} AND workspace_id = $${i}
     RETURNING *`,
    params,
  );
  return result.rows[0] ? rowToBatch(result.rows[0]) : null;
}

export async function deleteBatch(workspaceId: string, batchId: string): Promise<boolean> {
  await ensureEnrollmentSchema();
  const result = await pool().query(
    `DELETE FROM app.batches WHERE id = $1 AND workspace_id = $2`,
    [batchId, workspaceId],
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Batch membership ─────────────────────────────────────────────────────────

export async function addStudentsToBatches(input: {
  workspaceId: string;
  batchIds: string[];
  studentIds: string[];
  /** `null` records a system-initiated assignment (e.g. paid enrollment
   * webhook). batch_members.assigned_by is FK to origin_users(id), so a
   * sentinel string like "system" violates the constraint. */
  assignedBy: string | null;
}): Promise<BatchMember[]> {
  await ensureEnrollmentSchema();
  if (input.batchIds.length === 0 || input.studentIds.length === 0) return [];
  const client = await pool().connect();
  const created: BatchMember[] = [];
  try {
    await client.query("BEGIN");
    for (const batchId of input.batchIds) {
      for (const studentId of input.studentIds) {
        const result = await client.query(
          `INSERT INTO app.batch_members (batch_id, workspace_id, student_id, status, assigned_by)
           VALUES ($1, $2, $3, 'active', $4)
           ON CONFLICT (batch_id, student_id) DO UPDATE
             SET status = 'active', removed_at = NULL, assigned_at = NOW()
           RETURNING *`,
          [batchId, input.workspaceId, studentId, input.assignedBy],
        );
        created.push(rowToBatchMember(result.rows[0]));
      }
    }
    // Flip enrollment to active for any students that were previously unassigned.
    for (const studentId of input.studentIds) {
      await setEnrollmentStatus(input.workspaceId, studentId, "active");
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return created;
}

export async function removeStudentFromBatch(input: {
  workspaceId: string;
  batchId: string;
  studentId: string;
}): Promise<boolean> {
  await ensureEnrollmentSchema();
  const result = await pool().query(
    `UPDATE app.batch_members
     SET status = 'removed', removed_at = NOW()
     WHERE workspace_id = $1 AND batch_id = $2 AND student_id = $3 AND status = 'active'
     RETURNING student_id`,
    [input.workspaceId, input.batchId, input.studentId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listBatchMembers(
  workspaceId: string,
  batchId: string,
): Promise<(BatchMember & { studentName: string | null; studentEmail: string | null })[]> {
  await ensureEnrollmentSchema();
  const result = await pool().query(
    `SELECT m.*, u.name AS student_name, u.email AS student_email
     FROM app.batch_members m
     INNER JOIN origin_users u ON u.id = m.student_id
     WHERE m.workspace_id = $1 AND m.batch_id = $2 AND m.status = 'active'
     ORDER BY m.assigned_at DESC`,
    [workspaceId, batchId],
  );
  return result.rows.map((row) => ({
    ...rowToBatchMember(row),
    studentName: (row.student_name as string | null) ?? null,
    studentEmail: (row.student_email as string | null) ?? null,
  }));
}

export async function listStudentBatches(
  workspaceId: string,
  studentId: string,
): Promise<Batch[]> {
  await ensureEnrollmentSchema();
  const result = await pool().query(
    `SELECT b.*
     FROM app.batches b
     INNER JOIN app.batch_members m ON m.batch_id = b.id
     WHERE m.workspace_id = $1 AND m.student_id = $2 AND m.status = 'active'
     ORDER BY b.created_at DESC`,
    [workspaceId, studentId],
  );
  return result.rows.map(rowToBatch);
}

export async function isStudentInBatch(
  workspaceId: string,
  batchId: string,
  studentId: string,
): Promise<boolean> {
  await ensureEnrollmentSchema();
  const result = await pool().query(
    `SELECT 1 FROM app.batch_members
     WHERE workspace_id = $1 AND batch_id = $2 AND student_id = $3 AND status = 'active'
     LIMIT 1`,
    [workspaceId, batchId, studentId],
  );
  return (result.rowCount ?? 0) > 0;
}
