import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceOwnerOrAdmin } from "@/server/workspaces/authz";
import { createCode, rotateActiveCode } from "@/server/workspaces/codes";
import { listCodesForWorkspace } from "@/server/workspaces/store";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "../../../_utils";

const createSchema = z.object({
  codeType: z.enum(["student_join", "staff_invite", "batch_join"]),
  rawDisplay: z.string().min(4).max(32).optional(),
  rotate: z.boolean().optional(),
  batchId: z.string().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function GET(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("orgCodes");
    const workspaceId = await getWorkspaceId(context);
    await requireWorkspaceOwnerOrAdmin(request, workspaceId);
    const codes = await listCodesForWorkspace(workspaceId);
    return teacherJson({ codes });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("orgCodes");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceOwnerOrAdmin(request, workspaceId);
    const body = await parseJsonBody(request);
    const parsed = createSchema.parse(body);

    if (parsed.rotate) {
      const rotated = await rotateActiveCode({
        workspaceId,
        actorUserId: ctx.auth.userId,
        codeType: parsed.codeType,
        newRawDisplay: parsed.rawDisplay,
        requestId: requestIdOf(request),
      });
      return teacherJson({ code: rotated }, { status: 201 });
    }

    if (!parsed.rawDisplay) {
      return teacherJson(
        { detail: "rawDisplay is required when not rotating." },
        { status: 400 },
      );
    }

    const code = await createCode({
      workspaceId,
      createdBy: ctx.auth.userId,
      codeType: parsed.codeType,
      rawDisplay: parsed.rawDisplay,
      batchId: parsed.batchId ?? null,
      expiresAt: parsed.expiresAt ?? null,
      requestId: requestIdOf(request),
    });
    return teacherJson({ code }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
