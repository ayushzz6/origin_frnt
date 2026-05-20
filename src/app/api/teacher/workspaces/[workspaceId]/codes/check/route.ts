import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceOwnerOrAdmin } from "@/server/workspaces/authz";
import { checkCodeAvailability } from "@/server/workspaces/codes";

import {
  getWorkspaceId,
  handleTeacherError,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "../../../../_utils";

const schema = z.object({ rawDisplay: z.string().min(1).max(64) });

export async function POST(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("orgCodes");
    const workspaceId = await getWorkspaceId(context);
    await requireWorkspaceOwnerOrAdmin(request, workspaceId);
    const body = await parseJsonBody(request);
    const { rawDisplay } = schema.parse(body);
    const result = await checkCodeAvailability(rawDisplay);
    return teacherJson(result);
  } catch (error) {
    return handleTeacherError(error);
  }
}
