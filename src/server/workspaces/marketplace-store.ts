/**
 * Paid enrollment and marketplace store (Phase 12).
 * Aligned to V1/teacher-admin-launch-plan/02-database-schema-design.md:
 *   commerce.workspace_offerings + commerce.enrollment_orders.
 */

import type { Pool } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";

import { createEnrollmentOrderId, createWorkspaceOfferingId } from "./ids";
import { ensureCommerceSchema } from "./commerce-schema";
import { ensureWorkspaceSchema } from "./schema";
import type {
  EnrollmentOrder,
  EnrollmentOrderStatus,
  InstitutePublicProfile,
  OfferingStatus,
  WorkspaceOffering,
} from "./types";

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function rowToOffering(row: Record<string, unknown>): WorkspaceOffering {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    priceMinor: Number(row.price_minor) || 0,
    currency: row.currency as string,
    targetBatchId: (row.target_batch_id as string | null) ?? null,
    status: row.status as OfferingStatus,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

function rowToOrder(row: Record<string, unknown>): EnrollmentOrder {
  return {
    id: row.id as string,
    offeringId: row.offering_id as string,
    workspaceId: row.workspace_id as string,
    studentId: row.student_id as string,
    status: row.status as EnrollmentOrderStatus,
    provider: (row.provider as string | null) ?? null,
    providerPaymentId: (row.provider_payment_id as string | null) ?? null,
    amountMinor: Number(row.amount_minor) || 0,
    currency: row.currency as string,
    enrollmentId: (row.enrollment_id as string | null) ?? null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

// ─── workspace_offerings ──────────────────────────────────────────────────────

export type CreateOfferingInput = {
  workspaceId: string;
  title: string;
  description?: string | null;
  priceMinor: number;
  currency?: string;
  targetBatchId?: string | null;
  status?: OfferingStatus;
  metadata?: Record<string, unknown>;
};

export async function createOffering(input: CreateOfferingInput): Promise<WorkspaceOffering> {
  await ensureCommerceSchema();
  const id = createWorkspaceOfferingId();
  const result = await pool().query(
    `INSERT INTO commerce.workspace_offerings
       (id, workspace_id, title, description, price_minor, currency,
        target_batch_id, status, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
     RETURNING *`,
    [
      id,
      input.workspaceId,
      input.title,
      input.description ?? null,
      input.priceMinor,
      input.currency ?? "INR",
      input.targetBatchId ?? null,
      input.status ?? "draft",
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return rowToOffering(result.rows[0]);
}

export async function getOffering(workspaceId: string, offeringId: string): Promise<WorkspaceOffering | null> {
  await ensureCommerceSchema();
  const result = await pool().query(
    `SELECT * FROM commerce.workspace_offerings WHERE id = $1 AND workspace_id = $2`,
    [offeringId, workspaceId],
  );
  return result.rows[0] ? rowToOffering(result.rows[0]) : null;
}

export async function listOfferings(
  workspaceId: string,
  filter?: { status?: OfferingStatus | "all" },
): Promise<WorkspaceOffering[]> {
  await ensureCommerceSchema();
  const params: unknown[] = [workspaceId];
  let where = "workspace_id = $1";
  if (filter?.status && filter.status !== "all") {
    params.push(filter.status);
    where += ` AND status = $${params.length}`;
  }
  const result = await pool().query(
    `SELECT * FROM commerce.workspace_offerings WHERE ${where} ORDER BY created_at DESC`,
    params,
  );
  return result.rows.map(rowToOffering);
}

export type UpdateOfferingPatch = Partial<{
  title: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  targetBatchId: string | null;
  status: OfferingStatus;
  metadata: Record<string, unknown>;
}>;

export async function updateOffering(
  workspaceId: string,
  offeringId: string,
  patch: UpdateOfferingPatch,
): Promise<WorkspaceOffering | null> {
  await ensureCommerceSchema();
  const column: Record<string, string> = {
    title: "title",
    description: "description",
    priceMinor: "price_minor",
    currency: "currency",
    targetBatchId: "target_batch_id",
    status: "status",
    metadata: "metadata",
  };
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const key of Object.keys(patch) as Array<keyof UpdateOfferingPatch>) {
    const value = patch[key];
    if (value === undefined) continue;
    const col = column[key as string];
    if (!col) continue;
    if (key === "metadata") {
      fields.push(`${col} = $${i++}::jsonb`);
      values.push(JSON.stringify(value));
    } else {
      fields.push(`${col} = $${i++}`);
      values.push(value);
    }
  }
  if (fields.length === 0) return getOffering(workspaceId, offeringId);
  values.push(offeringId, workspaceId);
  const result = await pool().query(
    `UPDATE commerce.workspace_offerings
     SET ${fields.join(", ")}
     WHERE id = $${i++} AND workspace_id = $${i}
     RETURNING *`,
    values,
  );
  return result.rows[0] ? rowToOffering(result.rows[0]) : null;
}

// ─── enrollment_orders ────────────────────────────────────────────────────────

export type CreateEnrollmentOrderInput = {
  workspaceId: string;
  offeringId: string;
  studentId: string;
  amountMinor: number;
  currency?: string;
  /** Optional at create time. Set when the payment intent is initialized
   * with the provider. */
  provider?: string | null;
  providerPaymentId?: string | null;
};

export async function createEnrollmentOrder(input: CreateEnrollmentOrderInput): Promise<EnrollmentOrder> {
  await ensureCommerceSchema();
  const id = createEnrollmentOrderId();
  const result = await pool().query(
    `INSERT INTO commerce.enrollment_orders
       (id, offering_id, workspace_id, student_id, status,
        provider, provider_payment_id, amount_minor, currency)
     VALUES ($1,$2,$3,$4,'created',$5,$6,$7,$8)
     RETURNING *`,
    [
      id,
      input.offeringId,
      input.workspaceId,
      input.studentId,
      input.provider ?? null,
      input.providerPaymentId ?? null,
      input.amountMinor,
      input.currency ?? "INR",
    ],
  );
  return rowToOrder(result.rows[0]);
}

export async function getOrder(workspaceId: string, orderId: string): Promise<EnrollmentOrder | null> {
  await ensureCommerceSchema();
  const result = await pool().query(
    `SELECT * FROM commerce.enrollment_orders WHERE id = $1 AND workspace_id = $2`,
    [orderId, workspaceId],
  );
  return result.rows[0] ? rowToOrder(result.rows[0]) : null;
}

export type UpdateOrderExtras = {
  provider?: string | null;
  providerPaymentId?: string | null;
  enrollmentId?: string | null;
};

export async function updateOrderStatus(
  orderId: string,
  workspaceId: string,
  status: EnrollmentOrderStatus,
  extras?: UpdateOrderExtras,
): Promise<EnrollmentOrder | null> {
  await ensureCommerceSchema();
  const fields = ["status = $3", "updated_at = NOW()"];
  const params: unknown[] = [orderId, workspaceId, status];
  let i = 4;
  if (extras?.provider !== undefined) {
    fields.push(`provider = $${i++}`);
    params.push(extras.provider);
  }
  if (extras?.providerPaymentId !== undefined) {
    fields.push(`provider_payment_id = $${i++}`);
    params.push(extras.providerPaymentId);
  }
  if (extras?.enrollmentId !== undefined) {
    fields.push(`enrollment_id = $${i++}`);
    params.push(extras.enrollmentId);
  }
  const result = await pool().query(
    `UPDATE commerce.enrollment_orders
     SET ${fields.join(", ")}
     WHERE id = $1 AND workspace_id = $2
     RETURNING *`,
    params,
  );
  return result.rows[0] ? rowToOrder(result.rows[0]) : null;
}

export async function listStudentOrders(studentId: string): Promise<EnrollmentOrder[]> {
  await ensureCommerceSchema();
  const result = await pool().query(
    `SELECT * FROM commerce.enrollment_orders WHERE student_id = $1 ORDER BY created_at DESC`,
    [studentId],
  );
  return result.rows.map(rowToOrder);
}

// ─── Public institute profile (read-side projection) ──────────────────────────

export async function getInstitutePublicProfile(workspaceId: string): Promise<InstitutePublicProfile | null> {
  await ensureWorkspaceSchema();
  await ensureCommerceSchema();
  const wsResult = await pool().query(
    `SELECT * FROM app.teacher_workspaces
     WHERE id = $1 AND workspace_type = 'institute' AND status = 'active'`,
    [workspaceId],
  );
  if (wsResult.rows.length === 0) return null;
  const ws = wsResult.rows[0];

  const offeringsResult = await pool().query(
    `SELECT * FROM commerce.workspace_offerings
     WHERE workspace_id = $1 AND status = 'active'
     ORDER BY created_at DESC`,
    [workspaceId],
  );
  const activeOfferings = offeringsResult.rows.map(rowToOffering);

  const countsResult = await pool().query(
    `SELECT
       (SELECT COUNT(*) FROM app.workspace_student_enrollments
          WHERE workspace_id = $1 AND status = 'active') AS student_count,
       (SELECT COUNT(*) FROM app.batches
          WHERE workspace_id = $1 AND status IN ('active', 'draft')) AS batch_count`,
    [workspaceId],
  );

  return {
    workspaceId,
    displayName: ws.display_name as string,
    legalName: (ws.legal_name as string | null) ?? null,
    city: (ws.city as string | null) ?? null,
    state: (ws.state as string | null) ?? null,
    country: (ws.country as string | null) ?? "IN",
    subjects: (ws.subjects as string[] | null) ?? [],
    courses: (ws.courses as string[] | null) ?? [],
    logoUrl: null,
    description: null,
    activeOfferings,
    studentCount: Number(countsResult.rows[0].student_count) || 0,
    batchCount: Number(countsResult.rows[0].batch_count) || 0,
    verified: ws.verification_status === "verified",
  };
}

export async function listPublicInstitutes(
  filter?: { subject?: string; city?: string; limit?: number },
): Promise<InstitutePublicProfile[]> {
  await ensureWorkspaceSchema();
  const params: unknown[] = [];
  const conditions = ["w.workspace_type = 'institute'", "w.status = 'active'"];
  if (filter?.subject) {
    params.push(filter.subject);
    conditions.push(`$${params.length} = ANY(w.subjects)`);
  }
  if (filter?.city) {
    params.push(filter.city);
    conditions.push(`w.city = $${params.length}`);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const limit = filter?.limit ?? 20;
  params.push(limit);
  const result = await pool().query(
    `SELECT w.id, w.display_name, w.legal_name, w.city, w.state, w.country,
            w.subjects, w.courses, w.verification_status,
            (SELECT COUNT(*) FROM app.workspace_student_enrollments
               WHERE workspace_id = w.id AND status = 'active') AS student_count,
            (SELECT COUNT(*) FROM app.batches
               WHERE workspace_id = w.id AND status IN ('active', 'draft')) AS batch_count
     FROM app.teacher_workspaces w
     ${where}
     ORDER BY w.verification_status DESC, w.created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return result.rows.map((row) => ({
    workspaceId: row.id as string,
    displayName: row.display_name as string,
    legalName: (row.legal_name as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    state: (row.state as string | null) ?? null,
    country: (row.country as string | null) ?? "IN",
    subjects: (row.subjects as string[] | null) ?? [],
    courses: (row.courses as string[] | null) ?? [],
    logoUrl: null,
    description: null,
    activeOfferings: [],
    studentCount: Number(row.student_count) || 0,
    batchCount: Number(row.batch_count) || 0,
    verified: row.verification_status === "verified",
  }));
}
