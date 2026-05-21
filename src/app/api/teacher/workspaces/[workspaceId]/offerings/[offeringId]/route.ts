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
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "../../../../_utils";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  priceAmount: z.number().int().positive().optional(),
  durationMonths: z.number().int().positive().nullable().optional(),
  batchIds: z.array(z.string()).optional(),
  subject: z.string().max(80).nullable().optional(),
  classLevel: z.string().max(40).nullable().optional(),
  maxEnrollments: z.number().int().positive().nullable().optional(),
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
    const ctx = await requireWorkspaceMember(request, workspaceId, ["owner", "admin"]);
    const body = await parseJsonBody(request);
    const parsed = updateSchema.parse(body);
    const updated = await updateOfferingService({
      workspaceId,
      offeringId,
      patch: parsed,
      userId: ctx.auth.userId,
    });
    return teacherJson({ offering: updated });
  } catch (error) {
    return handleTeacherError(error);
  }
}
