/**
 * Workspace student enrollment store: joining a workspace via code,
 * listing unassigned/active students, suspending or removing enrollment.
 *
 * Batch membership lives in ./batches.ts.
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureEnrollmentSchema } from "./enrollment-schema";
import { createEnrollmentId } from "./ids";
import type {
  EnrollmentSource,
  EnrollmentStatus,
  EnrollmentWithStudent,
  WorkspaceStudentEnrollment,
} from "./types";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function rowToEnrollment(row: Record<string, unknown>): WorkspaceStudentEnrollment {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    studentId: row.student_id as string,
    source: row.source as EnrollmentSource,
    joinCodeId: (row.join_code_id as string | null) ?? null,
    status: row.status as EnrollmentStatus,
    enrolledAt: new Date(row.enrolled_at as string).toISOString(),
    assignedAt: row.assigned_at ? new Date(row.assigned_at as string).toISOString() : null,
    suspendedAt: row.suspended_at ? new Date(row.suspended_at as string).toISOString() : null,
    leftAt: row.left_at ? new Date(row.left_at as string).toISOString() : null,
    notes: (row.notes as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

export type EnrollStudentInput = {
  workspaceId: string;
  studentId: string;
  source: EnrollmentSource;
  joinCodeId?: string | null;
  initialStatus?: EnrollmentStatus;
  client?: PoolClient;
};

export async function enrollStudent(
  input: EnrollStudentInput,
): Promise<{ enrollment: WorkspaceStudentEnrollment; isNew: boolean }> {
  await ensureEnrollmentSchema();
  const runner = input.client ?? pool();
  const id = createEnrollmentId();
  const status = input.initialStatus ?? "unassigned";
  const result = await runner.query(
    `INSERT INTO app.workspace_student_enrollments (
       id, workspace_id, student_id, source, join_code_id, status
     ) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (workspace_id, student_id) DO UPDATE
       SET status = CASE
         WHEN app.workspace_student_enrollments.status = 'left' THEN EXCLUDED.status
         ELSE app.workspace_student_enrollments.status
       END
     RETURNING *,
       (xmax = 0) AS inserted`,
    [id, input.workspaceId, input.studentId, input.source, input.joinCodeId ?? null, status],
  );
  const row = result.rows[0];
  return {
    enrollment: rowToEnrollment(row),
    isNew: row.inserted === true,
  };
}

export async function listEnrollments(
  workspaceId: string,
  filter?: { status?: EnrollmentStatus | "all" },
): Promise<EnrollmentWithStudent[]> {
  await ensureEnrollmentSchema();
  const params: unknown[] = [workspaceId];
  let where = "e.workspace_id = $1";
  if (filter?.status && filter.status !== "all") {
    params.push(filter.status);
    where += ` AND e.status = $${params.length}`;
  }
  const result = await pool().query(
    `SELECT e.*, u.name AS student_name, u.email AS student_email
     FROM app.workspace_student_enrollments e
     INNER JOIN origin_users u ON u.id = e.student_id
     WHERE ${where}
     ORDER BY e.enrolled_at DESC`,
    params,
  );
  return result.rows.map((row) => ({
    ...rowToEnrollment(row),
    studentName: (row.student_name as string | null) ?? null,
    studentEmail: (row.student_email as string | null) ?? null,
  }));
}

export async function getEnrollment(
  workspaceId: string,
  studentId: string,
): Promise<WorkspaceStudentEnrollment | null> {
  await ensureEnrollmentSchema();
  const result = await pool().query(
    `SELECT * FROM app.workspace_student_enrollments
     WHERE workspace_id = $1 AND student_id = $2`,
    [workspaceId, studentId],
  );
  return result.rows[0] ? rowToEnrollment(result.rows[0]) : null;
}

export async function setEnrollmentStatus(
  workspaceId: string,
  studentId: string,
  status: EnrollmentStatus,
  patch?: { notes?: string | null },
): Promise<WorkspaceStudentEnrollment | null> {
  await ensureEnrollmentSchema();
  const params: unknown[] = [workspaceId, studentId, status];
  const fields: string[] = ["status = $3"];
  if (status === "active") fields.push("assigned_at = COALESCE(assigned_at, NOW())");
  if (status === "suspended") fields.push("suspended_at = NOW()");
  if (status === "left") fields.push("left_at = NOW()");
  if (patch?.notes !== undefined) {
    params.push(patch.notes);
    fields.push(`notes = $${params.length}`);
  }
  const result = await pool().query(
    `UPDATE app.workspace_student_enrollments
     SET ${fields.join(", ")}
     WHERE workspace_id = $1 AND student_id = $2
     RETURNING *`,
    params,
  );
  return result.rows[0] ? rowToEnrollment(result.rows[0]) : null;
}

export async function studentHasActiveEnrollment(
  workspaceId: string,
  studentId: string,
): Promise<boolean> {
  const enrollment = await getEnrollment(workspaceId, studentId);
  return !!enrollment && (enrollment.status === "active" || enrollment.status === "unassigned");
}
