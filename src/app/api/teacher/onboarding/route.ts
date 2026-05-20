import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireAuth } from "@/server/authz";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import {
  onboardInstitute,
  onboardPersonalTeacher,
} from "@/server/workspaces/onboarding";

import {
  handleTeacherError,
  requestIdOf,
  teacherJson,
} from "../_utils";

const personalSchema = z.object({
  workspaceType: z.literal("personal"),
  displayName: z.string().min(1).max(120),
  subjects: z.array(z.string().max(40)).optional(),
  city: z.string().max(80).optional().nullable(),
  state: z.string().max(80).optional().nullable(),
});

const instituteSchema = z.object({
  workspaceType: z.literal("institute"),
  displayName: z.string().min(1).max(120),
  legalName: z.string().max(160).optional().nullable(),
  rawCode: z.string().min(4).max(32),
  subjects: z.array(z.string().max(40)).optional(),
  courses: z.array(z.string().max(80)).optional(),
  city: z.string().max(80).optional().nullable(),
  state: z.string().max(80).optional().nullable(),
});

const onboardingSchema = z.discriminatedUnion("workspaceType", [
  personalSchema,
  instituteSchema,
]);

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("workspaces");
    const auth = await requireAuth(request);
    if (auth.role !== "teacher" && auth.role !== "admin") {
      return teacherJson(
        { detail: "Only teacher or admin accounts can create workspaces." },
        { status: 403 },
      );
    }
    const body = await parseJsonBody(request);
    const parsed = onboardingSchema.parse(body);
    const requestId = requestIdOf(request);

    if (parsed.workspaceType === "personal") {
      const result = await onboardPersonalTeacher({
        ownerUserId: auth.userId,
        displayName: parsed.displayName,
        subjects: parsed.subjects ?? [],
        city: parsed.city ?? null,
        state: parsed.state ?? null,
        requestId,
      });
      return teacherJson(result, { status: 201 });
    }

    const result = await onboardInstitute({
      ownerUserId: auth.userId,
      displayName: parsed.displayName,
      legalName: parsed.legalName ?? null,
      rawCode: parsed.rawCode,
      subjects: parsed.subjects ?? [],
      courses: parsed.courses ?? [],
      city: parsed.city ?? null,
      state: parsed.state ?? null,
      requestId,
    });
    return teacherJson(result, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
