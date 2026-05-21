/**
 * POST /api/teacher/workspaces/[workspaceId]/offerings  — create offering
 * GET  /api/teacher/workspaces/[workspaceId]/offerings  — list offerings
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import {
  createOfferingService,
  listOfferingsService,
} from "@/server/workspaces/marketplace-service";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

const CreateOfferingSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  priceMinor: z.number().int().min(0),
  currency: z.string().min(3).max(8).optional(),
  targetBatchId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const STATUS_VALUES = ["draft", "active", "paused", "archived", "all"] as const;

export async function POST(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("paidEnrollment");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner",
      "admin",
      "teacher",
    ]);
    const body = await parseJsonBody(request);
    const parsed = CreateOfferingSchema.safeParse(body);
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.message }, { status: 400 });
    }
    const offering = await createOfferingService({
      workspaceId,
      actorUserId: ctx.auth.userId,
      title: parsed.data.title,
      description: parsed.data.description,
      priceMinor: parsed.data.priceMinor,
      currency: parsed.data.currency,
      targetBatchId: parsed.data.targetBatchId,
      metadata: parsed.data.metadata,
      requestId: requestIdOf(request),
    });
    return teacherJson({ offering }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function GET(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("paidEnrollment");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId);
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const status =
      rawStatus && STATUS_VALUES.includes(rawStatus as (typeof STATUS_VALUES)[number])
        ? (rawStatus as (typeof STATUS_VALUES)[number])
        : undefined;
    const offerings = await listOfferingsService(workspaceId, ctx.auth.userId, {
      status: status === "all" ? "all" : status,
    });
    return teacherJson({ offerings });
  } catch (error) {
    return handleTeacherError(error);
  }
}
