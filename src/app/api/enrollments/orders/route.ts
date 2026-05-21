/**
 * POST /api/enrollments/orders            — create a new order
 * POST /api/enrollments/orders?action=…   — mark_payment_pending | mark_paid | mark_failed | refund
 * GET  /api/enrollments/orders            — list current student's orders
 *
 * Aligned to commerce.enrollment_orders. The mark_paid action is the
 * webhook entry point — it's idempotent on (provider, providerPaymentId)
 * so a duplicate provider callback yields the same paid order, not a
 * second enrollment.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireAuth } from "@/server/authz";
import {
  createOrderService,
  listStudentOrdersService,
  markOrderFailedService,
  markOrderPaidService,
  markOrderPaymentPendingService,
  refundOrderService,
} from "@/server/workspaces/marketplace-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const CreateOrderSchema = z.object({
  workspaceId: z.string(),
  offeringId: z.string(),
});

const MarkPaymentPendingSchema = z.object({
  orderId: z.string(),
  workspaceId: z.string(),
  provider: z.string().min(1),
  providerPaymentId: z.string().min(1),
});

const MarkPaidSchema = MarkPaymentPendingSchema;

const MarkFailedSchema = z.object({
  orderId: z.string(),
  workspaceId: z.string(),
  reason: z.string().nullable().optional(),
});

const RefundSchema = z.object({
  orderId: z.string(),
  workspaceId: z.string(),
  reason: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("paidEnrollment");
    const ctx = await requireAuth(request);
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const body = await parseJsonBody(request);

    if (action === "mark_payment_pending") {
      const parsed = MarkPaymentPendingSchema.safeParse(body);
      if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
      const order = await markOrderPaymentPendingService(parsed.data);
      return teacherJson({ order });
    }

    if (action === "mark_paid") {
      const parsed = MarkPaidSchema.safeParse(body);
      if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
      const order = await markOrderPaidService(parsed.data);
      return teacherJson({ order });
    }

    if (action === "mark_failed") {
      const parsed = MarkFailedSchema.safeParse(body);
      if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
      const order = await markOrderFailedService(parsed.data);
      return teacherJson({ order });
    }

    if (action === "refund") {
      const parsed = RefundSchema.safeParse(body);
      if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
      const order = await refundOrderService({
        orderId: parsed.data.orderId,
        workspaceId: parsed.data.workspaceId,
        actorUserId: ctx.userId,
        reason: parsed.data.reason,
      });
      return teacherJson({ order });
    }

    // Default: create a new order
    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.message }, { status: 400 });
    }
    const order = await createOrderService({
      workspaceId: parsed.data.workspaceId,
      offeringId: parsed.data.offeringId,
      studentId: ctx.userId,
    });
    return teacherJson({ order }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("paidEnrollment");
    const ctx = await requireAuth(request);
    const orders = await listStudentOrdersService(ctx.userId);
    return teacherJson({ orders });
  } catch (error) {
    return handleTeacherError(error);
  }
}
