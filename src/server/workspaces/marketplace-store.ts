/**
 * Paid enrollment and marketplace store (Phase 12).
 */

import type { Pool } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";

import { createEnrollmentOrderId, createPaymentIntentId, createWorkspaceOfferingId } from "./ids";
import { ensureEnrollmentSchema } from "./enrollment-schema";
import type { EnrollmentOrder, EnrollmentOrderStatus, InstitutePublicProfile, OfferingStatus, PaymentProvider, WorkspaceOffering } from "./types";

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function rowToOffering(row: Record<string, unknown>): WorkspaceOffering {
  return {
    id: row.id as string, workspaceId: row.workspace_id as string, title: row.title as string,
    description: (row.description as string | null) ?? null, status: row.status as OfferingStatus,
    priceAmount: Number(row.price_amount) || 0, priceCurrency: row.price_currency as string,
    durationMonths: (row.duration_months as number | null) ?? null,
    batchIds: (row.batch_ids as string[]) ?? [], subject: (row.subject as string | null) ?? null,
    classLevel: (row.class_level as string | null) ?? null,
    maxEnrollments: (row.max_enrollments as number | null) ?? null,
    currentEnrollments: Number(row.current_enrollments) || 0,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

function rowToOrder(row: Record<string, unknown>): EnrollmentOrder {
  return {
    id: row.id as string, workspaceId: row.workspace_id as string, offeringId: row.offering_id as string,
    studentId: row.student_id as string, status: row.status as EnrollmentOrderStatus,
    paymentProvider: row.payment_provider as PaymentProvider,
    paymentIntentId: (row.payment_intent_id as string | null) ?? null,
    paymentProviderOrderId: (row.payment_provider_order_id as string | null) ?? null,
    amount: Number(row.amount) || 0, currency: row.currency as string,
    enrolledBatchId: (row.enrolled_batch_id as string | null) ?? null,
    enrolledAt: row.enrolled_at ? new Date(row.enrolled_at as string).toISOString() : null,
    paymentCompletedAt: row.payment_completed_at ? new Date(row.payment_completed_at as string).toISOString() : null,
    refundedAt: row.refunded_at ? new Date(row.refunded_at as string).toISOString() : null,
    refundReason: (row.refund_reason as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export async function createOffering(input: {
  workspaceId: string; title: string; description?: string | null; priceAmount: number;
  priceCurrency?: string; durationMonths?: number | null; batchIds?: string[];
  subject?: string | null; classLevel?: string | null; maxEnrollments?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<WorkspaceOffering> {
  await ensureEnrollmentSchema();
  const id = createWorkspaceOfferingId();
  const result = await pool().query(
    `INSERT INTO app.workspace_offerings (id, workspace_id, title, description, price_amount, price_currency,
       duration_months, batch_ids, subject, class_level, max_enrollments, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) RETURNING *`,
    [id, input.workspaceId, input.title, input.description ?? null, input.priceAmount,
     input.priceCurrency ?? "INR", input.durationMonths ?? null, input.batchIds ?? [],
     input.subject ?? null, input.classLevel ?? null, input.maxEnrollments ?? null,
     JSON.stringify(input.metadata ?? {})],
  );
  return rowToOffering(result.rows[0]);
}

export async function getOffering(workspaceId: string, offeringId: string): Promise<WorkspaceOffering | null> {
  await ensureEnrollmentSchema();
  const result = await pool().query(`SELECT * FROM app.workspace_offerings WHERE id = $1 AND workspace_id = $2`, [offeringId, workspaceId]);
  return result.rows[0] ? rowToOffering(result.rows[0]) : null;
}

export async function listOfferings(workspaceId: string, filter?: { status?: OfferingStatus | "all" }): Promise<WorkspaceOffering[]> {
  await ensureEnrollmentSchema();
  const params: unknown[] = [workspaceId];
  let where = "workspace_id = $1";
  if (filter?.status && filter.status !== "all") { params.push(filter.status); where += ` AND status = $${params.length}`; }
  const result = await pool().query(`SELECT * FROM app.workspace_offerings WHERE ${where} ORDER BY created_at DESC`, params);
  return result.rows.map(rowToOffering);
}

export async function updateOffering(workspaceId: string, offeringId: string, patch: Partial<{
  title: string; description: string | null; status: OfferingStatus; priceAmount: number;
  durationMonths: number | null; batchIds: string[]; subject: string | null;
  classLevel: string | null; maxEnrollments: number | null; metadata: Record<string, unknown>;
}>): Promise<WorkspaceOffering | null> {
  await ensureEnrollmentSchema();
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  const column: Record<string, string> = {
    title: "title", description: "description", status: "status", priceAmount: "price_amount",
    durationMonths: "duration_months", batchIds: "batch_ids", subject: "subject",
    classLevel: "class_level", maxEnrollments: "max_enrollments", metadata: "metadata",
  };
  for (const key of Object.keys(patch)) {
    const value = patch[key as keyof typeof patch];
    if (value === undefined) continue;
    if (key === "metadata") { fields.push(`${column[key]} = $${i++}::jsonb`); values.push(JSON.stringify(value)); }
    else if (key === "batchIds") { fields.push(`${column[key]} = $${i++}::text[]`); values.push(value); }
    else { fields.push(`${column[key]} = $${i++}`); values.push(value); }
  }
  if (fields.length === 0) return getOffering(workspaceId, offeringId);
  values.push(offeringId, workspaceId);
  const result = await pool().query(
    `UPDATE app.workspace_offerings SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${i++} AND workspace_id = $${i} RETURNING *`,
    values,
  );
  return result.rows[0] ? rowToOffering(result.rows[0]) : null;
}

export async function incrementOfferingEnrollments(offeringId: string): Promise<void> {
  await ensureEnrollmentSchema();
  await pool().query(`UPDATE app.workspace_offerings SET current_enrollments = current_enrollments + 1, updated_at = NOW() WHERE id = $1`, [offeringId]);
}

export async function createEnrollmentOrder(input: {
  workspaceId: string; offeringId: string; studentId: string; paymentProvider: PaymentProvider;
  amount: number; currency?: string; metadata?: Record<string, unknown>;
}): Promise<EnrollmentOrder> {
  await ensureEnrollmentSchema();
  const id = createEnrollmentOrderId();
  const paymentIntentId = createPaymentIntentId();
  const result = await pool().query(
    `INSERT INTO app.enrollment_orders (id, workspace_id, offering_id, student_id, status,
       payment_provider, payment_intent_id, amount, currency, metadata)
     VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9::jsonb) RETURNING *`,
    [id, input.workspaceId, input.offeringId, input.studentId, input.paymentProvider,
     paymentIntentId, input.amount, input.currency ?? "INR", JSON.stringify(input.metadata ?? {})],
  );
  return rowToOrder(result.rows[0]);
}

export async function getOrder(workspaceId: string, orderId: string): Promise<EnrollmentOrder | null> {
  await ensureEnrollmentSchema();
  const result = await pool().query(`SELECT * FROM app.enrollment_orders WHERE id = $1 AND workspace_id = $2`, [orderId, workspaceId]);
  return result.rows[0] ? rowToOrder(result.rows[0]) : null;
}

export async function updateOrderStatus(orderId: string, workspaceId: string, status: EnrollmentOrderStatus, extra?: {
  paymentProviderOrderId?: string | null; enrolledBatchId?: string | null;
  enrolledAt?: string | null; paymentCompletedAt?: string | null;
  refundedAt?: string | null; refundReason?: string | null;
}): Promise<EnrollmentOrder | null> {
  await ensureEnrollmentSchema();
  const fields = ["status = $3", "updated_at = NOW()"];
  const params: unknown[] = [orderId, workspaceId, status];
  let i = 4;
  if (extra?.paymentProviderOrderId !== undefined) { fields.push(`payment_provider_order_id = $${i++}`); params.push(extra.paymentProviderOrderId); }
  if (extra?.enrolledBatchId !== undefined) { fields.push(`enrolled_batch_id = $${i++}`); params.push(extra.enrolledBatchId); }
  if (extra?.enrolledAt !== undefined) { fields.push(`enrolled_at = $${i++}`); params.push(extra.enrolledAt); }
  if (extra?.paymentCompletedAt !== undefined) { fields.push(`payment_completed_at = $${i++}`); params.push(extra.paymentCompletedAt); }
  if (extra?.refundedAt !== undefined) { fields.push(`refunded_at = $${i++}`); params.push(extra.refundedAt); }
  if (extra?.refundReason !== undefined) { fields.push(`refund_reason = $${i++}`); params.push(extra.refundReason); }
  params.push(orderId, workspaceId);
  const result = await pool().query(
    `UPDATE app.enrollment_orders SET ${fields.join(", ")} WHERE id = $${i++} AND workspace_id = $${i} RETURNING *`,
    params,
  );
  return result.rows[0] ? rowToOrder(result.rows[0]) : null;
}

export async function listStudentOrders(studentId: string): Promise<EnrollmentOrder[]> {
  await ensureEnrollmentSchema();
  const result = await pool().query(`SELECT * FROM app.enrollment_orders WHERE student_id = $1 ORDER BY created_at DESC`, [studentId]);
  return result.rows.map(rowToOrder);
}

export async function getInstitutePublicProfile(workspaceId: string): Promise<InstitutePublicProfile | null> {
  await ensureEnrollmentSchema();
  const wsResult = await pool().query(
    `SELECT w.* FROM app.teacher_workspaces w WHERE w.id = $1 AND w.workspace_type = 'institute' AND w.status = 'active'`,
    [workspaceId],
  );
  if (wsResult.rows.length === 0) return null;
  const ws = wsResult.rows[0];
  const offeringsResult = await pool().query(
    `SELECT * FROM app.workspace_offerings WHERE workspace_id = $1 AND status = 'active' ORDER BY created_at DESC`,
    [workspaceId],
  );
  const offerings = offeringsResult.rows.map(rowToOffering);
  const countsResult = await pool().query(
    `SELECT (SELECT COUNT(*) FROM app.workspace_student_enrollments WHERE workspace_id = $1 AND status = 'active') AS student_count,
            (SELECT COUNT(*) FROM app.batches WHERE workspace_id = $1 AND status IN ('active', 'draft')) AS batch_count`,
    [workspaceId],
  );
  return {
    workspaceId, displayName: ws.display_name as string, legalName: (ws.legal_name as string | null) ?? null,
    city: (ws.city as string | null) ?? null, state: (ws.state as string | null) ?? null,
    country: ws.country as string, subjects: (ws.subjects as string[]) ?? [],
    courses: (ws.courses as string[]) ?? [], logoUrl: null, description: null,
    activeOfferings: offerings,
    studentCount: Number(countsResult.rows[0].student_count) || 0,
    batchCount: Number(countsResult.rows[0].batch_count) || 0,
    verified: ws.verification_status === "verified",
  };
}

export async function listPublicInstitutes(filter?: { subject?: string; city?: string; limit?: number }): Promise<InstitutePublicProfile[]> {
  await ensureEnrollmentSchema();
  const params: unknown[] = [];
  const conditions = ["w.workspace_type = 'institute'", "w.status = 'active'"];
  if (filter?.subject) { params.push(filter.subject); conditions.push(`$${params.length} = ANY(w.subjects)`); }
  if (filter?.city) { params.push(filter.city); conditions.push(`w.city = $${params.length}`); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const limit = filter?.limit ?? 20;
  const result = await pool().query(
    `SELECT w.id, w.display_name, w.city, w.state, w.country, w.subjects, w.courses, w.verification_status,
            (SELECT COUNT(*) FROM app.workspace_student_enrollments WHERE workspace_id = w.id AND status = 'active') AS student_count,
            (SELECT COUNT(*) FROM app.batches WHERE workspace_id = w.id AND status IN ('active', 'draft')) AS batch_count
     FROM app.teacher_workspaces w ${where} ORDER BY w.verification_status DESC, w.created_at DESC LIMIT $${params.length + 1}`,
    [...params, limit],
  );
  return result.rows.map((row) => ({
    workspaceId: row.id as string, displayName: row.display_name as string, legalName: null,
    city: (row.city as string | null) ?? null, state: (row.state as string | null) ?? null,
    country: row.country as string, subjects: (row.subjects as string[]) ?? [],
    courses: (row.courses as string[]) ?? [], logoUrl: null, description: null,
    activeOfferings: [], studentCount: Number(row.student_count) || 0,
    batchCount: Number(row.batch_count) || 0, verified: row.verification_status === "verified",
  }));
}
