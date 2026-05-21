/**
 * GET   /api/teacher/workspaces/[workspaceId]/offerings/[offeringId]
 * PATCH /api/teacher/workspaces/[workspaceId]/offerings/[offeringId]
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import {
  getOfferingService,
  updateOfferingService,
} from "@/server/workspaces/marketplace-service";

import {
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "../../../../_utils";

const updateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  priceMinor: z.number().int().min(0).optional(),
  currency: z.string().min(3).max(8).optional(),
  targetBatchId: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; offeringId: string }> },
) {
  try {
    requireFeatureEnabled("paidEnrollment");
    const { workspaceId, offeringId } = await context.params;
    await requireWorkspaceMember(request, workspaceId);
    const offering = await getOfferingService(workspaceId, offeringId);
    if (!offering) {
      return teacherJson({ detail: "Offering not found." }, { status: 404 });
    }
    return teacherJson({ offering });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; offeringId: string }> },
) {
  try {
    requireFeatureEnabled("paidEnrollment");
    const { workspaceId, offeringId } = await context.params;
    const ctx = await requireWorkspaceMember(request, workspaceId, ["owner", "admin", "teacher"]);
    const body = await parseJsonBody(request);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.message }, { status: 400 });
    }
    const offering = await updateOfferingService({
      workspaceId,
      offeringId,
      actorUserId: ctx.auth.userId,
      patch: parsed.data,
      requestId: requestIdOf(request),
    });
    if (!offering) {
      return teacherJson({ detail: "Offering not found." }, { status: 404 });
    }
    return teacherJson({ offering });
  } catch (error) {
    return handleTeacherError(error);
  }
}
