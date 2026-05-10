import type { NextRequest } from "next/server";

import { badRequest, getSlugSegments, parseJsonBody } from "@/server/http";
import { handleStudyRequest } from "@/server/study";
import { generalLimiter, checkRateLimit } from "@/lib/rate-limit";

type RouteContext = {
  params: Promise<{ slug?: string[] }>;
};

async function resolveSlug(context: RouteContext): Promise<string[]> {
  const params = await context.params;
  return getSlugSegments(params);
}

async function dispatch(method: string, request: NextRequest, context: RouteContext) {
  const slug = await resolveSlug(context);

  const identifier =
    request.headers.get("x-origin-user-id") ??
    request.cookies.get("origin_access_token")?.value ??
    request.headers.get("authorization")?.replace("Bearer ", "") ??
    request.headers.get("x-forwarded-for") ??
    "unknown";
  const limited = await checkRateLimit(generalLimiter, identifier);
  if (limited) return limited;

  let payload: Record<string, unknown> = {};
  if (method !== "GET" && method !== "DELETE") {
    try {
      payload = await parseJsonBody<Record<string, unknown>>(request);
    } catch {
      return badRequest("Invalid JSON body.");
    }
  }
  return handleStudyRequest(method, slug, request, payload);
}

export async function GET(request: NextRequest, context: RouteContext) {
  return dispatch("GET", request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return dispatch("POST", request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return dispatch("PUT", request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return dispatch("PATCH", request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return dispatch("DELETE", request, context);
}
