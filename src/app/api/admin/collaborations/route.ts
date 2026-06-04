/**
 * GET  /api/admin/collaborations              — list collaborations (optional ?status=)
 * POST /api/admin/collaborations              — set a collaboration's status
 *   body: { workspaceId, status, commissionBps?, razorpayRouteAccountId?, flow1Enabled?, flow2Enabled? }
 *
 * Platform-admin approval surface for teacher-connect collaborations. Approving
 * (status='active') lights up both enrollment flows for the institute. Gated by
 * teacherConnect; admin-only; every transition is audited in the service layer.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import {
  listCollaborationsService,
  setCollaborationStatusService,
} from "@/server/connect/collaboration-service";

import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";

const COLLAB_STATUSES = ["pending", "active", "paused", "terminated", "rejected"] as const;

const setStatusSchema = z.object({
  workspaceId: z.string().min(1),
  status: z.enum(COLLAB_STATUSES),
  commissionBps: z.number().int().min(0).max(10000).nullable().optional(),
  razorpayRouteAccountId: z.string().nullable().optional(),
  flow1Enabled: z.boolean().nullable().optional(),
  flow2Enabled: z.boolean().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("teacherConnect");
    await requireRole(request, ["admin"]);
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const status =
      rawStatus && (COLLAB_STATUSES as readonly string[]).includes(rawStatus)
        ? (rawStatus as (typeof COLLAB_STATUSES)[number])
        : rawStatus === "all"
          ? "all"
          : undefined;
    const collaborations = await listCollaborationsService(status ? { status } : undefined);
    return teacherJson({ collaborations });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("teacherConnect");
    const ctx = await requireRole(request, ["admin"]);
    const body = await parseJsonBody(request);
    const parsed = setStatusSchema.safeParse(body);
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.message }, { status: 400 });
    }
    const collaboration = await setCollaborationStatusService({
      workspaceId: parsed.data.workspaceId,
      status: parsed.data.status,
      adminUserId: ctx.userId,
      commissionBps: parsed.data.commissionBps,
      razorpayRouteAccountId: parsed.data.razorpayRouteAccountId,
      flow1Enabled: parsed.data.flow1Enabled,
      flow2Enabled: parsed.data.flow2Enabled,
      requestId: requestIdOf(request),
    });
    return teacherJson({ collaboration });
  } catch (error) {
    return handleTeacherError(error);
  }
}
