import { NextResponse, type NextRequest } from "next/server";

import { AuthzError, authzErrorResponse } from "@/server/authz";
import { FeatureDisabledError } from "@/lib/feature-flags";

export type WorkspaceIdRouteContext = {
  params: Promise<{ workspaceId: string }>;
};

export async function getWorkspaceId(context: WorkspaceIdRouteContext): Promise<string> {
  const { workspaceId } = await context.params;
  return workspaceId;
}

export function teacherJson<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function handleTeacherError(error: unknown): NextResponse {
  if (error instanceof FeatureDisabledError) {
    return NextResponse.json({ detail: error.message }, { status: 404 });
  }
  if (error instanceof AuthzError) {
    return authzErrorResponse(error) as NextResponse;
  }
  if (error instanceof Error) {
    const status = (error as { status?: number }).status ?? 400;
    return NextResponse.json({ detail: error.message }, { status });
  }
  console.error("[teacher api] unexpected error", error);
  return NextResponse.json({ detail: "Internal server error." }, { status: 500 });
}

export function requestIdOf(request: NextRequest): string | null {
  return request.headers.get("x-request-id");
}
