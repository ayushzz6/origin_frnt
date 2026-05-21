/**
 * Paid enrollment and marketplace service (Phase 12).
 */

import { AuthzError } from "@/server/authz";

import { recordAuditEvent } from "./audit";
import { addStudentsToBatches } from "./batches";
import {
  createEnrollmentOrder,
  createOffering,
  getInstitutePublicProfile,
  getOrder,
  getOffering,
  incrementOfferingEnrollments,
  listOfferings,
  listPublicInstitutes,
  listStudentOrders,
  updateOffering,
  updateOrderStatus,
} from "./marketplace-store";
import { getActiveMembership, getWorkspaceById } from "./store";
import type { EnrollmentOrder, InstitutePublicProfile, OfferingStatus, WorkspaceOffering } from "./types";

export async function createOfferingService(input: {
  workspaceId: string; teacherId: string; title: string; description?: string | null;
  priceAmount: number; priceCurrency?: string; durationMonths?: number | null;
  batchIds?: string[]; subject?: string | null; classLevel?: string | null;
  maxEnrollments?: number | null; metadata?: Record<string, unknown>;
}): Promise<WorkspaceOffering> {
  const ws = await getWorkspaceById(input.workspaceId);
  if (!ws) throw new AuthzError(403, "Workspace not found.");
  const membership = await getActiveMembership(input.workspaceId, input.teacherId);
  if (!membership || !["owner", "admin", "teacher"].includes(membership.role)) throw new AuthzError(403, "Insufficient permissions to create offerings.");
  return createOffering({
    workspaceId: input.workspaceId, title: input.title, description: input.description,
    priceAmount: input.priceAmount, priceCurrency: input.priceCurrency,
    durationMonths: input.durationMonths, batchIds: input.batchIds,
    subject: input.subject, classLevel: input.classLevel,
    maxEnrollments: input.maxEnrollments, metadata: input.metadata,
  });
}

export async function listOfferingsService(workspaceId: string, userId: string, filter?: { status?: OfferingStatus | "all" }): Promise<WorkspaceOffering[]> {
  const membership = await getActiveMembership(workspaceId, userId);
  if (!membership) throw new AuthzError(403, "Not a workspace member.");
  return listOfferings(workspaceId, filter);
}

export async function getOfferingService(
  workspaceId: string,
  offeringId: string,
): Promise<WorkspaceOffering | null> {
  return getOffering(workspaceId, offeringId);
}

export async function updateOfferingService(input: {
  workspaceId: string; offeringId: string; userId: string; patch: Partial<{
    title: string; description: string | null; status: OfferingStatus; priceAmount: number;
    durationMonths: number | null; batchIds: string[]; subject: string | null;
    classLevel: string | null; maxEnrollments: number | null; metadata: Record<string, unknown>;
  }>;
}): Promise<WorkspaceOffering | null> {
  const membership = await getActiveMembership(input.workspaceId, input.userId);
  if (!membership || !["owner", "admin", "teacher"].includes(membership.role)) throw new AuthzError(403, "Insufficient permissions.");
  return updateOffering(input.workspaceId, input.offeringId, input.patch);
}

export async function createOrderService(input: {
  workspaceId: string; offeringId: string; studentId: string; paymentProvider: "razorpay" | "stripe";
  amount: number; currency?: string; metadata?: Record<string, unknown>;
}): Promise<EnrollmentOrder> {
  const offering = await getOffering(input.workspaceId, input.offeringId);
  if (!offering || offering.status !== "active") throw new AuthzError(400, "Offering not available.");
  if (offering.maxEnrollments && offering.currentEnrollments >= offering.maxEnrollments) throw new AuthzError(400, "Enrollment limit reached.");
  return createEnrollmentOrder({
    workspaceId: input.workspaceId, offeringId: input.offeringId, studentId: input.studentId,
    paymentProvider: input.paymentProvider, amount: input.amount,
    currency: input.currency, metadata: input.metadata,
  });
}

export async function completePaymentService(input: {
  orderId: string; workspaceId: string; studentId: string; paymentProviderOrderId: string;
  batchId?: string | null;
}): Promise<EnrollmentOrder> {
  const order = await getOrder(input.workspaceId, input.orderId);
  if (!order || order.studentId !== input.studentId) throw new AuthzError(403, "Order not found.");
  if (order.status !== "pending") throw new AuthzError(400, `Order is ${order.status}, cannot complete payment.`);
  const enrolledAt = new Date().toISOString();
  const updated = await updateOrderStatus(order.id, input.workspaceId, "completed", {
    paymentProviderOrderId: input.paymentProviderOrderId,
    enrolledBatchId: input.batchId ?? null,
    enrolledAt,
    paymentCompletedAt: enrolledAt,
  });
  if (!updated) throw new Error("Failed to update order status.");
  if (input.batchId) {
    await addStudentsToBatches({
      workspaceId: input.workspaceId, batchIds: [input.batchId],
      studentIds: [input.studentId], assignedBy: "system",
    });
    await incrementOfferingEnrollments(order.offeringId);
  }
  await recordAuditEvent({
    actorUserId: input.studentId, workspaceId: input.workspaceId,
    entityType: "enrollment_order", entityId: order.id, action: "order.payment_completed",
    before: order, after: updated,
  });
  return updated;
}

export async function refundOrderService(input: {
  orderId: string; workspaceId: string; adminUserId: string; reason: string;
}): Promise<EnrollmentOrder> {
  const order = await getOrder(input.workspaceId, input.orderId);
  if (!order) throw new AuthzError(403, "Order not found.");
  if (order.status !== "completed") throw new AuthzError(400, `Order is ${order.status}, cannot refund.`);
  const membership = await getActiveMembership(input.workspaceId, input.adminUserId);
  if (!membership || !["owner", "admin"].includes(membership.role)) throw new AuthzError(403, "Insufficient permissions.");
  const refundedAt = new Date().toISOString();
  const updated = await updateOrderStatus(order.id, input.workspaceId, "refunded", { refundedAt, refundReason: input.reason });
  if (!updated) throw new Error("Failed to update order status.");
  await recordAuditEvent({
    actorUserId: input.adminUserId, workspaceId: input.workspaceId,
    entityType: "enrollment_order", entityId: order.id, action: "order.refunded",
    before: order, after: updated,
  });
  return updated;
}

export async function listStudentOrdersService(studentId: string): Promise<EnrollmentOrder[]> {
  return listStudentOrders(studentId);
}

export async function getInstituteProfileService(workspaceId: string): Promise<InstitutePublicProfile | null> {
  return getInstitutePublicProfile(workspaceId);
}

export async function listPublicInstitutesService(filter?: { subject?: string; city?: string; limit?: number }): Promise<InstitutePublicProfile[]> {
  return listPublicInstitutes(filter);
}
