import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import {
  getBatchTopicAccuracyLive,
  getBatchLeaderboardLive,
} from "@/server/workspaces/batch-cohort-store";
import { setBatchTopicCoverage } from "@/server/workspaces/batch-topic-coverage-store";
import { recordAuditEvent } from "@/server/workspaces/audit";

import {
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "../../../../../_utils";

export async function GET(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; batchId: string }> },
) {
  try {
    requireFeatureEnabled("teacherAnalytics");
    const { workspaceId, batchId } = await context.params;
    await requireWorkspaceMember(request, workspaceId);
    const url = new URL(request.url);
    const subject = url.searchParams.get("subject");
    const type = url.searchParams.get("type");

    if (type === "weak-topics") {
      const weakTopics = await getBatchTopicAccuracyLive(workspaceId, batchId, {
        subject: subject ?? undefined,
        weakOnly: true,
      });
      return teacherJson({ weakTopics });
    }

    if (type === "leaderboard") {
      const entries = await getBatchLeaderboardLive(workspaceId, batchId);
      // Match the historical snapshot shape the client expects ([0].entries).
      const leaderboardHistory = entries.length
        ? [{ entries, snapshotAt: new Date().toISOString() }]
        : [];
      return teacherJson({ leaderboardHistory });
    }

    const snapshots = await getBatchTopicAccuracyLive(workspaceId, batchId, {
      subject: subject ?? undefined,
    });
    return teacherJson({ snapshots });
  } catch (error) {
    return handleTeacherError(error);
  }
}

/**
 * Toggle a weak topic's "covered in next class" flag for the batch. Folded into
 * this (already-registered) route rather than a child `coverage/` subroute, which a
 * Next.js 16 production build failed to register as a new path.
 */
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
