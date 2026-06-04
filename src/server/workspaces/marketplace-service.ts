/**
 * Paid enrollment and marketplace service (Phase 12).
 * Aligned to V1/teacher-admin-launch-plan/02-database-schema-design.md.
 *
 * Lifecycle (commerce.order_status):
 *   created → payment_pending → (paid | failed | cancelled)
 *   paid    → refunded
 *
 * When an order transitions to "paid" we:
 *   1. Create or update the row in app.workspace_student_enrollments
 *      (source = 'paid_app') and link enrollment_id back on the order.
 *   2. Assign the student to the offering's target_batch_id if set.
 *
 * Idempotency is guaranteed by the unique partial index on
 * (provider, provider_payment_id) in commerce.enrollment_orders, plus
 * the UNIQUE (workspace_id, student_id) constraint on
 * app.workspace_student_enrollments — repeated payment webhooks
 * resolve to the same enrollment record instead of duplicating.
 */

import { AuthzError } from "@/server/authz";
import { isFeatureEnabled } from "@/lib/feature-flags";

import { recordAuditEvent } from "./audit";
import { addStudentsToBatches, getBatch } from "./batches";
import {
  createEnrollmentOrder as storeCreateEnrollmentOrder,
  createOffering as storeCreateOffering,
  getInstitutePublicProfile,
  getOffering,
  getOrder,
  listOfferings,
  listPublicInstitutes,
  listStudentOrders,
  updateOffering as storeUpdateOffering,
  updateOrderStatus,
  type CreateEnrollmentOrderInput,
  type CreateOfferingInput,
  type UpdateOfferingPatch,
} from "./marketplace-store";
import { getActiveMembership, getWorkspaceById } from "./store";
import { enrollStudent } from "./enrollments";
import type {
  EnrollmentOrder,
  InstitutePublicProfile,
  OfferingStatus,
  WorkspaceOffering,
} from "./types";

const TEACHER_ROLES = new Set(["owner", "admin", "teacher"]);
const ADMIN_ROLES = new Set(["owner", "admin"]);

async function requireTeacher(workspaceId: string, userId: string): Promise<void> {
  const ws = await getWorkspaceById(workspaceId);
  if (!ws) throw new AuthzError(404, "Workspace not found.");
  const m = await getActiveMembership(workspaceId, userId);
  if (!m || !TEACHER_ROLES.has(m.role)) {
    throw new AuthzError(403, "Teacher access required.");
  }
}

async function requireWorkspaceAdmin(workspaceId: string, userId: string): Promise<void> {
  const m = await getActiveMembership(workspaceId, userId);
  if (!m || !ADMIN_ROLES.has(m.role)) {
    throw new AuthzError(403, "Workspace admin required.");
  }
}

// ─── Offering CRUD ────────────────────────────────────────────────────────────

export async function createOfferingService(input: {
  workspaceId: string;
  actorUserId: string;
  title: string;
  description?: string | null;
  priceMinor: number;
  currency?: string;
  targetBatchId?: string | null;
  metadata?: Record<string, unknown>;
  requestId?: string | null;
}): Promise<WorkspaceOffering> {
  await requireTeacher(input.workspaceId, input.actorUserId);
  if (input.priceMinor < 0) throw new AuthzError(400, "Price must be non-negative.");

  const created: CreateOfferingInput = {
    workspaceId: input.workspaceId,
    title: input.title,
    description: input.description,
    priceMinor: input.priceMinor,
    currency: input.currency,
    targetBatchId: input.targetBatchId,
    metadata: input.metadata,
  };
  const offering = await storeCreateOffering(created);

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "workspace_offering",
    entityId: offering.id,
    action: "offering.created",
    after: offering,
    requestId: input.requestId,
  });

  return offering;
}

export async function listOfferingsService(
  workspaceId: string,
  actorUserId: string,
  filter?: { status?: OfferingStatus | "all" },
): Promise<WorkspaceOffering[]> {
  await requireTeacher(workspaceId, actorUserId);
  return listOfferings(workspaceId, filter);
}

export async function getOfferingService(
  workspaceId: string,
  offeringId: string,
): Promise<WorkspaceOffering | null> {
  return getOffering(workspaceId, offeringId);
}

export async function updateOfferingService(input: {
  workspaceId: string;
  offeringId: string;
  actorUserId: string;
  patch: UpdateOfferingPatch;
  requestId?: string | null;
}): Promise<WorkspaceOffering | null> {
  await requireTeacher(input.workspaceId, input.actorUserId);
  if (input.patch.priceMinor !== undefined && input.patch.priceMinor < 0) {
    throw new AuthzError(400, "Price must be non-negative.");
  }
  const before = await getOffering(input.workspaceId, input.offeringId);
  if (!before) throw new AuthzError(404, "Offering not found.");

  const updated = await storeUpdateOffering(input.workspaceId, input.offeringId, input.patch);

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "workspace_offering",
    entityId: input.offeringId,
    action: "offering.updated",
    before,
    after: updated,
    requestId: input.requestId,
  });

  // Phase 14: publishing a recurring offering creates its Razorpay plan in the
  // background so checkout never pays the plan-creation cost. Dark unless
  // teacherConnect is on; a queue hiccup here must never block the publish.
  if (
    updated &&
    input.patch.status === "active" &&
    isFeatureEnabled("teacherConnect") &&
    (updated.billingPeriod ?? "monthly") === "monthly" &&
    !updated.razorpayPlanId
  ) {
    try {
      const { enqueueOfferingPlanCreation } = await import(
        "@/server/connect/enrollment-subscription-service"
      );
      await enqueueOfferingPlanCreation(updated.workspaceId, updated.id);
    } catch (error) {
      console.error("[marketplace] offering plan enqueue failed", error);
    }
  }

  return updated;
}

// ─── Order lifecycle ──────────────────────────────────────────────────────────

export async function createOrderService(input: {
  workspaceId: string;
  offeringId: string;
  studentId: string;
  /** Optional at this stage: the provider name + payment intent ID can
   * be added later via initiatePayment when the provider hands back an
   * ID. */
  provider?: string | null;
  providerPaymentId?: string | null;
}): Promise<EnrollmentOrder> {
  const offering = await getOffering(input.workspaceId, input.offeringId);
  if (!offering) throw new AuthzError(404, "Offering not found.");
  if (offering.status !== "active") {
    throw new AuthzError(400, `Offering is ${offering.status}; not available for purchase.`);
  }

  // Duplicate-purchase idempotency (plan: phase 12 acceptance "duplicate
  // purchase handled idempotently"). If the student already has a non-
  // terminal or paid order for this offering, return that one — never
  // create a parallel order.
  const existing = await findReusableOrderForStudent({
    workspaceId: input.workspaceId,
    offeringId: input.offeringId,
    studentId: input.studentId,
  });
  if (existing) return existing;

  const created: CreateEnrollmentOrderInput = {
    workspaceId: input.workspaceId,
    offeringId: input.offeringId,
    studentId: input.studentId,
    amountMinor: offering.priceMinor,
    currency: offering.currency,
    provider: input.provider,
    providerPaymentId: input.providerPaymentId,
  };
  const order = await storeCreateEnrollmentOrder(created);

  await recordAuditEvent({
    actorUserId: input.studentId,
    workspaceId: input.workspaceId,
    entityType: "enrollment_order",
    entityId: order.id,
    action: "order.created",
    after: order,
  });

  return order;
}

/** Find an order on the same (workspace, offering, student) tuple that
 * a new buy click should reuse instead of creating a duplicate:
 *   - status='paid'           → already bought, return same row.
 *   - status='created'        → checkout flow still in progress, reuse.
 *   - status='payment_pending'→ provider intent already issued, reuse.
 * 'failed', 'refunded', 'cancelled' are terminal — caller may retry. */
async function findReusableOrderForStudent(args: {
  workspaceId: string;
  offeringId: string;
  studentId: string;
}): Promise<EnrollmentOrder | null> {
  const all = await listStudentOrders(args.studentId);
  return (
    all.find(
      (o) =>
        o.workspaceId === args.workspaceId &&
        o.offeringId === args.offeringId &&
        (o.status === "paid" || o.status === "created" || o.status === "payment_pending"),
    ) ?? null
  );
}

export async function markOrderPaymentPendingService(input: {
  orderId: string;
  workspaceId: string;
  provider: string;
  providerPaymentId: string;
}): Promise<EnrollmentOrder | null> {
  const order = await getOrder(input.workspaceId, input.orderId);
  if (!order) throw new AuthzError(404, "Order not found.");
  if (order.status !== "created") {
    throw new AuthzError(409, `Order is ${order.status}, expected created.`);
  }
  return updateOrderStatus(input.orderId, input.workspaceId, "payment_pending", {
    provider: input.provider,
    providerPaymentId: input.providerPaymentId,
  });
}

/**
 * Webhook handler: provider confirms successful payment.
 * Idempotent — re-running on the same providerPaymentId returns the
 * already-paid order without duplicating the enrollment.
 */
export async function markOrderPaidService(input: {
  orderId: string;
  workspaceId: string;
  provider: string;
  providerPaymentId: string;
}): Promise<EnrollmentOrder> {
  const order = await getOrder(input.workspaceId, input.orderId);
  if (!order) throw new AuthzError(404, "Order not found.");
  if (order.status === "paid") return order; // idempotent re-entry
  if (order.status !== "created" && order.status !== "payment_pending") {
    throw new AuthzError(409, `Order is ${order.status}; cannot mark paid.`);
  }

  const offering = await getOffering(input.workspaceId, order.offeringId);
  if (!offering) throw new AuthzError(404, "Offering not found.");

  // Phase 14 back-port: only assign to the target batch when it still exists and
  // is active (closes the Phase-12 gap where a paid order could be routed to a
  // deleted/archived batch). The enrollment status mirrors whether we can assign.
  const targetBatch = offering.targetBatchId
    ? await getBatch(input.workspaceId, offering.targetBatchId)
    : null;
  const canAssignBatch = Boolean(targetBatch && targetBatch.status === "active");

  // Create or revive enrollment row first so we have its id to link.
  // enrollStudent() upserts on (workspace_id, student_id) and revives a
  // previously-left enrollment back to 'unassigned' so the batch
  // assignment below can move it to 'active'.
  const { enrollment } = await enrollStudent({
    workspaceId: input.workspaceId,
    studentId: order.studentId,
    source: "paid_app",
    initialStatus: canAssignBatch ? "active" : "unassigned",
  });

  const updated = await updateOrderStatus(input.orderId, input.workspaceId, "paid", {
    provider: input.provider,
    providerPaymentId: input.providerPaymentId,
    enrollmentId: enrollment.id,
  });
  if (!updated) throw new Error("Failed to mark order paid.");

  // Assign to batch only when it is a live target.
  if (canAssignBatch && offering.targetBatchId) {
    await addStudentsToBatches({
      workspaceId: input.workspaceId,
      batchIds: [offering.targetBatchId],
      studentIds: [order.studentId],
      // null = system-initiated; FK constraint disallows sentinel strings.
      assignedBy: null,
    });
  }

  await recordAuditEvent({
    actorUserId: order.studentId,
    workspaceId: input.workspaceId,
    entityType: "enrollment_order",
    entityId: order.id,
    action: "order.paid",
    before: order,
    after: updated,
  });

  return updated;
}

export async function markOrderFailedService(input: {
  orderId: string;
  workspaceId: string;
  reason?: string | null;
}): Promise<EnrollmentOrder | null> {
  const order = await getOrder(input.workspaceId, input.orderId);
  if (!order) throw new AuthzError(404, "Order not found.");
  if (order.status === "paid") {
    throw new AuthzError(409, "Cannot mark a paid order as failed; use refund instead.");
  }
  const updated = await updateOrderStatus(input.orderId, input.workspaceId, "failed");
  if (updated) {
    await recordAuditEvent({
      actorUserId: order.studentId,
      workspaceId: input.workspaceId,
      entityType: "enrollment_order",
      entityId: order.id,
      action: "order.failed",
      before: order,
      after: updated,
      requestId: input.reason ?? undefined,
    });
  }
  return updated;
}

export async function refundOrderService(input: {
  orderId: string;
  workspaceId: string;
  actorUserId: string;
  reason: string;
}): Promise<EnrollmentOrder> {
  await requireWorkspaceAdmin(input.workspaceId, input.actorUserId);
  const order = await getOrder(input.workspaceId, input.orderId);
  if (!order) throw new AuthzError(404, "Order not found.");
  if (order.status !== "paid") {
    throw new AuthzError(409, `Order is ${order.status}; only paid orders can be refunded.`);
  }
  const updated = await updateOrderStatus(input.orderId, input.workspaceId, "refunded");
  if (!updated) throw new Error("Failed to update order to refunded.");
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "enrollment_order",
    entityId: order.id,
    action: "order.refunded",
    before: order,
    after: { ...updated, refundReason: input.reason },
  });
  return updated;
}

export async function listStudentOrdersService(studentId: string): Promise<EnrollmentOrder[]> {
  return listStudentOrders(studentId);
}

// ─── Public marketplace read-side ─────────────────────────────────────────────

export async function getInstituteProfileService(workspaceId: string): Promise<InstitutePublicProfile | null> {
  return getInstitutePublicProfile(workspaceId);
}

export async function listPublicInstitutesService(
  filter?: { subject?: string; city?: string; limit?: number },
): Promise<InstitutePublicProfile[]> {
  return listPublicInstitutes(filter);
}
