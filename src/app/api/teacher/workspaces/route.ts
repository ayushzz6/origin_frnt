import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireAuth } from "@/server/authz";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { createTeacherWorkspace, listAccessibleWorkspaces } from "@/server/workspaces/service";

import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";

const createSchema = z.object({
  workspaceType: z.enum(["personal", "institute"]),
  displayName: z.string().min(1).max(120),
  legalName: z.string().max(160).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  state: z.string().max(80).optional().nullable(),
  country: z.string().length(2).optional(),
  subjects: z.array(z.string().max(40)).optional(),
  courses: z.array(z.string().max(80)).optional(),
});

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("workspaces");
    const auth = await requireAuth(request);
    const workspaces = await listAccessibleWorkspaces(auth.userId);
    return teacherJson({ workspaces });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("workspaces");
    const auth = await requireAuth(request);
    const body = await parseJsonBody(request);
    const parsed = createSchema.parse(body);
    const workspace = await createTeacherWorkspace({
      ownerUserId: auth.userId,
      workspaceType: parsed.workspaceType,
      displayName: parsed.displayName,
      legalName: parsed.legalName ?? null,
      city: parsed.city ?? null,
      state: parsed.state ?? null,
      country: parsed.country ?? "IN",
      subjects: parsed.subjects ?? [],
      courses: parsed.courses ?? [],
      requestId: requestIdOf(request),
    });
    return teacherJson({ workspace }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
