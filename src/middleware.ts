import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { CSRF_COOKIE_NAME, verifyRequestAccessJwt } from "@/server/auth-jwt";
import { getApiRoutePolicy, getAppRoutePolicy, normalizePathname, type RoutePolicy } from "@/server/route-policy";
import { isBearerTokenAuthorized } from "@/server/service-auth";

const REQUEST_ID_HEADER = "X-Request-Id";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_EXEMPT_API_PATHS = new Set([
  "/api/users/login",
  "/api/users/register",
  "/api/users/google-login",
  "/api/users/token/refresh",
]);

function requestIdFor(request: NextRequest): string {
  return request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
}

function withRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

function withNoIndex(response: NextResponse, policy: RoutePolicy): NextResponse {
  if (policy.kind !== "public" && policy.kind !== "unconfigured") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

function jsonAuthFailure(status: 401 | 403, detail: string, requestId: string): NextResponse {
  return withRequestId(NextResponse.json({ detail, requestId }, { status }), requestId);
}

function redirectToAuth(request: NextRequest, requestId: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/auth";
  url.searchParams.set("next", normalizePathname(request.nextUrl.pathname));
  return withRequestId(NextResponse.redirect(url), requestId);
}

function nextWithRequestId(
  request: NextRequest,
  requestId: string,
  policy: RoutePolicy,
  authHeaders?: Record<string, string>,
): NextResponse {
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  for (const [name, value] of Object.entries(authHeaders ?? {})) {
    headers.set(name, value);
  }
  return withNoIndex(withRequestId(NextResponse.next({ request: { headers } }), requestId), policy);
}

function isInternalAuthorized(request: NextRequest, policy: Extract<RoutePolicy, { kind: "internal" }>): boolean {
  return isBearerTokenAuthorized(request, policy.tokenName);
}

export async function middleware(request: NextRequest) {
  const requestId = requestIdFor(request);
  const pathname = normalizePathname(request.nextUrl.pathname);
  const isApi = pathname.startsWith("/api/");
  const policy = isApi ? getApiRoutePolicy(pathname) : getAppRoutePolicy(pathname);

  if (
    isApi &&
    !SAFE_METHODS.has(request.method.toUpperCase()) &&
    !CSRF_EXEMPT_API_PATHS.has(pathname)
  ) {
    const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    const csrfHeader = request.headers.get("x-csrf-token");
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return jsonAuthFailure(403, "Invalid CSRF token.", requestId);
    }
  }

  if (policy.kind === "unconfigured") {
    if (isApi) {
      return jsonAuthFailure(403, "Route policy is not configured.", requestId);
    }
    return redirectToAuth(request, requestId);
  }

  if (policy.kind === "internal") {
    if (!isInternalAuthorized(request, policy)) {
      return jsonAuthFailure(401, "Invalid internal service token.", requestId);
    }
    return nextWithRequestId(request, requestId, policy);
  }

  if (policy.kind === "public") {
    if (pathname === "/auth") {
      try {
        await verifyRequestAccessJwt(request);
        const next = request.nextUrl.searchParams.get("next");
        const url = request.nextUrl.clone();
        url.pathname = next && next.startsWith("/") ? next : "/dashboard";
        url.search = "";
        return withRequestId(NextResponse.redirect(url), requestId);
      } catch {
        // no active session; render auth page
      }
    }
    return nextWithRequestId(request, requestId, policy);
  }

  let claims;
  try {
    claims = await verifyRequestAccessJwt(request);
  } catch {
    if (isApi) {
      return jsonAuthFailure(401, "Authentication credentials were not provided.", requestId);
    }
    return redirectToAuth(request, requestId);
  }

  if (policy.kind === "role" && !policy.roles.includes(claims.role)) {
    if (isApi) {
      return jsonAuthFailure(403, "You do not have permission to perform this action.", requestId);
    }
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return withNoIndex(withRequestId(NextResponse.redirect(url), requestId), policy);
  }

  return nextWithRequestId(request, requestId, policy, {
    "x-origin-user-id": claims.sub,
    "x-origin-session-id": claims.sid,
    "x-origin-user-role": claims.role,
  });
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot)).*)",
  ],
};
