import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { setBatchTopicCoverage } from "@/server/workspaces/batch-topic-coverage-store";
import { recordAuditEvent } from "@/server/workspaces/audit";

import {
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "../../../../../../_utils";

export async function PATCH(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; batchId: string }> },
) {
  try {
    requireFeatureEnabled("teacherAnalytics");
    const { workspaceId, batchId } = await context.params;
    const ctx = await requireWorkspaceMember(request, workspaceId, ["owner", "admin", "teacher"]);
    const body = await request.json();
    const { subject, topic, covered } = z
      .object({ subject: z.string().min(1), topic: z.string().min(1), covered: z.boolean() })
      .parse(body);

    await setBatchTopicCoverage({
      workspaceId,
      batchId,
      subject,
      topic,
      covered,
      userId: ctx.auth.userId,
    });
    await recordAuditEvent({
      actorUserId: ctx.auth.userId,
      workspaceId,
      entityType: "batch",
      entityId: batchId,
      action: "batch.topic_coverage.updated",
      after: { subject, topic, covered },
      requestId: requestIdOf(request),
    });
    return teacherJson({ ok: true, subject, topic, covered });
  } catch (error) {
    return handleTeacherError(error);
  }
}
