import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import {
  getBatchTopicSnapshots,
  getBatchWeakTopics,
  getLeaderboardHistory,
} from "@/server/workspaces/analytics-store";

import {
  getWorkspaceId,
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
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

    if (type === "weak-topics") {
      const weakTopics = await getBatchWeakTopics(workspaceId, batchId, {
        subject: subject ?? undefined,
      });
      return teacherJson({ weakTopics });
    }

    if (type === "leaderboard") {
      const history = await getLeaderboardHistory(workspaceId, {
        batchId,
        limit: Math.min(limit, 50),
      });
      return teacherJson({ leaderboardHistory: history });
    }

    const snapshots = await getBatchTopicSnapshots(workspaceId, batchId, {
      subject: subject ?? undefined,
      limit: Math.min(limit, 100),
    });
    return teacherJson({ snapshots });
  } catch (error) {
    return handleTeacherError(error);
  }
}
