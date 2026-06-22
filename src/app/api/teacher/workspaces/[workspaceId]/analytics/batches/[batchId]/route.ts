import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import {
  getBatchTopicAccuracyLive,
  getBatchLeaderboardLive,
} from "@/server/workspaces/batch-cohort-store";

import {
  handleTeacherError,
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
