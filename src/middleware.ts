import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { CSRF_COOKIE_NAME, REFRESH_COOKIE_NAME, verifyRequestAccessJwt } from "@/server/auth-jwt";
import { checkRateLimit, mutationLimiter } from "@/lib/rate-limit";
import { findKillSwitchForPath } from "@/server/incidents";
import { getApiRoutePolicy, getAppRoutePolicy, normalizePathname, type RoutePolicy } from "@/server/route-policy";
import { isBearerTokenAuthorized } from "@/server/service-auth";

const RATE_LIMITED_MUTATION_PREFIXES = [
  "/api/teacher/",
  "/api/admin/",
  "/api/enrollments/",
];

const REQUEST_ID_HEADER = "X-Request-Id";
const CANONICAL_HOST = "www.o3origin.com";
const APEX_HOST = "o3origin.com";
const PRODUCTION_VERCEL_HOST = "origin-frnt.vercel.app";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_EXEMPT_API_PATHS = new Set([
  "/api/users/login",
  "/api/users/register",
  "/api/users/google-login",
  "/api/users/token/refresh",
  // Phase 13 drain receiver: signed by Vercel's drain HMAC, not a
  // session cookie, so the CSRF check would always fail.
  "/api/internal/observability/drain",
  // Razorpay subscriptions webhook: signed by Razorpay's HMAC, not a
  // session cookie, so the CSRF check would always fail.
  "/api/subscriptions/webhook",
]);

function requestIdFor(request: NextRequest): string {
  return request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
}

function withRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export function canonicalHostRedirectUrl(requestUrl: URL): URL | null {
  if (requestUrl.hostname !== APEX_HOST && requestUrl.hostname !== PRODUCTION_VERCEL_HOST) {
    return null;
  }
  const url = new URL(requestUrl.toString());
  url.protocol = "https:";
  url.hostname = CANONICAL_HOST;
  url.port = "";
  return url;
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

/** Where an authenticated user belongs by role. /dashboard is the student
 * home; teachers go to /teacher, admins to /admin. */
function homePathForRole(role: string | undefined | null): string {
  if (role === "teacher") return "/teacher";
  if (role === "admin") return "/admin";
  return "/dashboard";
}

function redirectToAuth(request: NextRequest, requestId: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/auth";
  url.search = "";
  url.searchParams.set("next", `${normalizePathname(request.nextUrl.pathname)}${request.nextUrl.search}`);
  return withRequestId(NextResponse.redirect(url), requestId);
}

function hasRefreshCookie(request: NextRequest): boolean {
  return Boolean(request.cookies.get(REFRESH_COOKIE_NAME)?.value);
}

function isSafeAppNext(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/api/");
}

function redirectToRefresh(request: NextRequest, requestId: string, nextOverride?: string | null): NextResponse {
  const url = request.nextUrl.clone();
  const currentPath = `${normalizePathname(request.nextUrl.pathname)}${request.nextUrl.search}`;
  url.pathname = "/auth/refresh";
  url.search = "";
  url.searchParams.set("next", isSafeAppNext(nextOverride) ? nextOverride : currentPath);
  const response = NextResponse.redirect(url);
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return withRequestId(response, requestId);
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

function isRateLimitedMutationPath(pathname: string, method: string): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false;
  return RATE_LIMITED_MUTATION_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function clientIdentifierFor(request: NextRequest, claims?: { sub?: string }): string {
  if (claims?.sub) return `u:${claims.sub}`;
  const xff = request.headers.get("x-forwarded-for");
  const ip = xff?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim();
  return `ip:${ip || "anonymous"}`;
}

export async function middleware(request: NextRequest) {
  const requestId = requestIdFor(request);
  const canonicalUrl = canonicalHostRedirectUrl(request.nextUrl);
  if (canonicalUrl) {
    return withRequestId(NextResponse.redirect(canonicalUrl, 308), requestId);
  }

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
        const claims = await verifyRequestAccessJwt(request);
        const next = request.nextUrl.searchParams.get("next");
        const url = request.nextUrl.clone();
        url.pathname = next && next.startsWith("/") ? next : homePathForRole(claims.role);
        url.search = "";
        return withRequestId(NextResponse.redirect(url), requestId);
      } catch {
        if (hasRefreshCookie(request)) {
          return redirectToRefresh(request, requestId, request.nextUrl.searchParams.get("next"));
        }
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
    if (hasRefreshCookie(request)) {
      return redirectToRefresh(request, requestId);
    }
    return redirectToAuth(request, requestId);
  }

  if (policy.kind === "role" && !policy.roles.includes(claims.role)) {
    if (isApi) {
      return jsonAuthFailure(403, "You do not have permission to perform this action.", requestId);
    }
    const url = request.nextUrl.clone();
    url.pathname = homePathForRole(claims.role);
    url.search = "";
    return withNoIndex(withRequestId(NextResponse.redirect(url), requestId), policy);
  }

  if (isApi && isRateLimitedMutationPath(pathname, request.method)) {
    const killed = await findKillSwitchForPath(pathname);
    if (killed) {
      return withRequestId(
        NextResponse.json(
          { detail: `This surface is temporarily disabled by an active incident.`, killedFlag: killed },
          {
            status: 503,
            headers: { "Retry-After": "60" },
          },
        ),
        requestId,
      );
    }
    const limited = await checkRateLimit(mutationLimiter, clientIdentifierFor(request, claims));
    if (limited) {
      return withRequestId(limited as unknown as NextResponse, requestId);
    }
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
