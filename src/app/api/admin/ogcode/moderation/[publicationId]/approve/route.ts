/**
 * POST /api/admin/ogcode/moderation/[publicationId]/approve
 *
 * Plan: 06-rbac-and-api-contracts.md ("Admin APIs"). Calls into the
 * shared reviewPublication service used by the teacher-side review
 * action so behaviour stays identical.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { reviewPublication } from "@/server/workspaces/ogcode-publishing-service";

import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";

const schema = z.object({
  /** If true, the approval immediately transitions to 'published' instead
   * of stopping at 'approved' (useful for fast-track admin reviews). */
  publish: z.boolean().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ publicationId: string }> },
) {
  try {
    requireFeatureEnabled("ogcodePublishing");
    const auth = await requireRole(request, ["admin"]);
    const { publicationId } = await context.params;
    const body = await parseJsonBody(request);
    const parsed = schema.safeParse(body ?? {});
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.message }, { status: 400 });
    }
    const publication = await reviewPublication({
      publicationId,
      action: parsed.data.publish ? "publish" : "approve",
      reviewerUserId: auth.userId,
      notes: parsed.data.notes,
      requestId: requestIdOf(request),
    });
    return teacherJson({ publication });
  } catch (error) {
    return handleTeacherError(error);
  }
}
