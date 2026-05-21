/**
 * POST /api/enrollments/orders
 * GET /api/enrollments/orders
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireAuth } from "@/server/authz";
import { completePaymentService, createOrderService, listStudentOrdersService, refundOrderService } from "@/server/workspaces/marketplace-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const CreateOrderSchema = z.object({
  workspaceId: z.string(),
  offeringId: z.string(),
  paymentProvider: z.enum(["razorpay", "stripe"]),
  amount: z.number().positive(),
  currency: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const CompletePaymentSchema = z.object({
  orderId: z.string(),
  workspaceId: z.string(),
  paymentProviderOrderId: z.string(),
  batchId: z.string().optional().nullable(),
});

const RefundOrderSchema = z.object({
  orderId: z.string(),
  workspaceId: z.string(),
  reason: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("paidEnrollment");
    const ctx = await requireAuth(request);
    const body = await parseJsonBody(request);
    const action = body?.action as string | undefined;
    if (action === "complete_payment") {
      const parsed = CompletePaymentSchema.safeParse(body);
      if (!parsed.success) return teacherJson({ error: parsed.error.message }, { status: 400 });
      const order = await completePaymentService({
        orderId: parsed.data.orderId, workspaceId: parsed.data.workspaceId,
        studentId: ctx.userId, paymentProviderOrderId: parsed.data.paymentProviderOrderId,
        batchId: parsed.data.batchId ?? null,
      });
      return teacherJson(order);
    }
    if (action === "refund") {
      const parsed = RefundOrderSchema.safeParse(body);
      if (!parsed.success) return teacherJson({ error: parsed.error.message }, { status: 400 });
      const order = await refundOrderService({
        orderId: parsed.data.orderId, workspaceId: parsed.data.workspaceId,
        adminUserId: ctx.userId, reason: parsed.data.reason,
      });
      return teacherJson(order);
    }
    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) return teacherJson({ error: parsed.error.message }, { status: 400 });
    const order = await createOrderService({
      workspaceId: parsed.data.workspaceId, offeringId: parsed.data.offeringId,
      studentId: ctx.userId, paymentProvider: parsed.data.paymentProvider,
      amount: parsed.data.amount, currency: parsed.data.currency,
      metadata: parsed.data.metadata,
    });
    return teacherJson(order, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("paidEnrollment");
    const ctx = await requireAuth(request);
    const orders = await listStudentOrdersService(ctx.userId);
    return teacherJson(orders);
  } catch (error) {
    return handleTeacherError(error);
  }
}
