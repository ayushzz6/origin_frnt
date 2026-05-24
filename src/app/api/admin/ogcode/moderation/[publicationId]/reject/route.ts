/**
 * POST /api/admin/ogcode/moderation/[publicationId]/reject
 *
 * Plan: 06-rbac-and-api-contracts.md ("Admin APIs"). Choose between hard
 * rejection (status='rejected') and changes-requested (status='changes_requested',
 * notes mandatory) via the request body.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { reviewPublication } from "@/server/workspaces/ogcode-publishing-service";

import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";

const schema = z.object({
  /** "reject" = permanent reject; "request_changes" = reviewer asks
   * teacher for changes (notes required). */
  mode: z.enum(["reject", "request_changes"]).default("reject"),
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
      action: parsed.data.mode,
      reviewerUserId: auth.userId,
      notes: parsed.data.notes,
      requestId: requestIdOf(request),
    });
    return teacherJson({ publication });
  } catch (error) {
    return handleTeacherError(error);
  }
}
