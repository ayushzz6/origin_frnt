import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { listVersions } from "@/server/workspaces/questions";
import { getQuestionById } from "@/server/workspaces/questions";
import { getTeacherQuestion } from "@/server/workspaces/questions-service";

import {
  getWorkspaceId,
  handleTeacherError,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

export async function GET(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; questionId: string }> },
) {
  try {
    requireFeatureEnabled("questionBag");
    const workspaceId = await getWorkspaceId(context);
    await requireWorkspaceMember(request, workspaceId);
    const { questionId } = await context.params;

    const question = await getTeacherQuestion(workspaceId, questionId);
    if (!question) {
      return teacherJson({ detail: "Question not found or access denied." }, { status: 404 });
    }

    const versions = await listVersions(questionId);
    return teacherJson({ versions });
  } catch (error) {
    return handleTeacherError(error);
  }
}