/**
 * POST /api/teacher/workspaces/[workspaceId]/offerings
 * GET /api/teacher/workspaces/[workspaceId]/offerings
 * PATCH /api/teacher/workspaces/[workspaceId]/offerings/[offeringId]
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { loadWorkspaceContext } from "@/server/workspaces/authz";
import { createOfferingService, listOfferingsService, updateOfferingService } from "@/server/workspaces/marketplace-service";

import {
  getWorkspaceId,
  handleTeacherError,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

const CreateOfferingSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  priceAmount: z.number().positive(),
  priceCurrency: z.string().optional(),
  durationMonths: z.number().int().positive().optional().nullable(),
  batchIds: z.array(z.string()).optional(),
  subject: z.string().optional().nullable(),
  classLevel: z.string().optional().nullable(),
  maxEnrollments: z.number().int().positive().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const UpdateOfferingSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  priceAmount: z.number().positive().optional(),
  durationMonths: z.number().int().positive().nullable().optional(),
  batchIds: z.array(z.string()).optional(),
  subject: z.string().nullable().optional(),
  classLevel: z.string().nullable().optional(),
  maxEnrollments: z.number().int().positive().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("paidEnrollment");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await loadWorkspaceContext(request, workspaceId);
    const body = await parseJsonBody(request);
    const parsed = CreateOfferingSchema.safeParse(body);
    if (!parsed.success) return teacherJson({ error: parsed.error.message }, { status: 400 });
    const offering = await createOfferingService({
      workspaceId, teacherId: ctx.auth.userId, title: parsed.data.title, description: parsed.data.description,
      priceAmount: parsed.data.priceAmount, priceCurrency: parsed.data.priceCurrency,
      durationMonths: parsed.data.durationMonths, batchIds: parsed.data.batchIds,
      subject: parsed.data.subject, classLevel: parsed.data.classLevel,
      maxEnrollments: parsed.data.maxEnrollments, metadata: parsed.data.metadata,
    });
    return teacherJson(offering, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function GET(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("paidEnrollment");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await loadWorkspaceContext(request, workspaceId);
    const url = new URL(request.url);
    const status = (url.searchParams.get("status") as "draft" | "active" | "archived" | null) ?? null;
    const offerings = await listOfferingsService(workspaceId, ctx.auth.userId, { status: status ?? undefined });
    return teacherJson(offerings);
  } catch (error) {
    return handleTeacherError(error);
  }
}

type OfferingIdRouteContext = {
  params: Promise<{ workspaceId: string; offeringId: string }>;
};

export async function PATCH(request: NextRequest, context: OfferingIdRouteContext) {
  try {
    requireFeatureEnabled("paidEnrollment");
    const { workspaceId, offeringId } = await context.params;
    const ctx = await loadWorkspaceContext(request, workspaceId);
    const body = await parseJsonBody(request);
    const parsed = UpdateOfferingSchema.safeParse(body);
    if (!parsed.success) return teacherJson({ error: parsed.error.message }, { status: 400 });
    const offering = await updateOfferingService({ workspaceId, offeringId, userId: ctx.auth.userId, patch: parsed.data });
    return teacherJson(offering);
  } catch (error) {
    return handleTeacherError(error);
  }
}
