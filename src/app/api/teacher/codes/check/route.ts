import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireAuth } from "@/server/authz";
import { generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { checkCodeAvailability } from "@/server/workspaces/codes";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const schema = z.object({ rawDisplay: z.string().min(1).max(64) });

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("orgCodes");
    const auth = await requireAuth(request);
    const limited = await checkRateLimit(generalLimiter, `code-check:${auth.userId}`);
    if (limited) return limited;
    const body = await parseJsonBody(request);
    const { rawDisplay } = schema.parse(body);
    const result = await checkCodeAvailability(rawDisplay);
    return teacherJson(result);
  } catch (error) {
    return handleTeacherError(error);
  }
}
