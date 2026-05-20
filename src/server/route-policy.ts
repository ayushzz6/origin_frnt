export type UserRole = "student" | "teacher" | "admin";

export type RoutePolicy =
  | { kind: "public" }
  | { kind: "authenticated" }
  | { kind: "role"; roles: UserRole[] }
  | { kind: "internal"; tokenName: "INTERNAL_CRON_TOKEN" }
  | { kind: "membership" }
  | { kind: "unconfigured" };

export const PUBLIC_API_PATHS = [
  "/api/health",
  "/api/users/login",
  "/api/users/register",
  "/api/users/google-login",
  "/api/users/token/refresh",
] as const;

export const INTERNAL_API_PREFIXES = ["/api/internal"] as const;

export const AUTHENTICATED_API_PREFIXES = [
  "/api/assessments",
  "/api/interaction",
  "/api/origin-ai",
  "/api/study",
  "/api/users",
  "/api/study-rooms",
  "/api/teacher",
  "/api/enrollments",
] as const;

export const MEMBERSHIP_API_PREFIXES = ["/api/study-rooms/[id]"] as const;

export const PUBLIC_APP_PATHS = ["/", "/auth", "/auth/refresh", "/role-selection", "/explore", "/premium"] as const;

export const PUBLIC_APP_PREFIXES = ["/videos"] as const;

export const AUTHENTICATED_APP_PREFIXES = [
  "/dashboard",
  "/tests",
  "/ogcode",
  "/leaderboard",
  "/milestones",
  "/profile",
  "/study-corner",
  "/study-rooms",
  "/tasks",
  "/pomodoro",
  "/dpp",
  "/doubt-solver",
  "/onboarding",
  "/books",
  "/teacher",
] as const;

export const ROLE_APP_PREFIXES = [
  { prefix: "/admin", roles: ["admin"] as UserRole[] },
] as const;

export function normalizePathname(pathname: string): string {
  return pathname === "/" ? pathname : pathname.replace(/\/+$/u, "");
}

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isRoomScopedApi(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "api" && parts[1] === "study-rooms" && Boolean(parts[2]);
}

export function getApiRoutePolicy(rawPathname: string): RoutePolicy {
  const pathname = normalizePathname(rawPathname);
  if (!pathname.startsWith("/api/")) {
    return { kind: "unconfigured" };
  }
  if ((PUBLIC_API_PATHS as readonly string[]).includes(pathname)) {
    return { kind: "public" };
  }
  if (INTERNAL_API_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix))) {
    return { kind: "internal", tokenName: "INTERNAL_CRON_TOKEN" };
  }
  if (isRoomScopedApi(pathname)) {
    return { kind: "membership" };
  }
  if (AUTHENTICATED_API_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix))) {
    return { kind: "authenticated" };
  }
  return { kind: "unconfigured" };
}

export function getAppRoutePolicy(rawPathname: string): RoutePolicy {
  const pathname = normalizePathname(rawPathname);
  if (pathname.startsWith("/api/")) {
    return getApiRoutePolicy(pathname);
  }
  if ((PUBLIC_APP_PATHS as readonly string[]).includes(pathname)) {
    return { kind: "public" };
  }
  if (PUBLIC_APP_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix))) {
    return { kind: "public" };
  }
  for (const entry of ROLE_APP_PREFIXES) {
    if (pathMatchesPrefix(pathname, entry.prefix)) {
      return { kind: "role", roles: [...entry.roles] };
    }
  }
  if (AUTHENTICATED_APP_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix))) {
    return { kind: "authenticated" };
  }
  return { kind: "unconfigured" };
}

export function isKnownApiRouteFile(routeFile: string): boolean {
  const normalized = routeFile.replace(/\\/g, "/");
  const marker = "/src/app/api/";
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex === -1 || !normalized.endsWith("/route.ts")) {
    return false;
  }

  const routePattern = `/api/${normalized
    .slice(markerIndex + marker.length, -"/route.ts".length)
    .replace(/\/\[\.\.\.slug\]$/u, "")
    .replace(/\/\[id\](?=\/|$)/u, "/[id]")}`;

  if (routePattern === "/api/users") return true;
  if (routePattern === "/api/study-rooms") return true;
  if (routePattern.startsWith("/api/study-rooms/[id]")) return true;
  if (routePattern.startsWith("/api/internal")) return true;

  return getApiRoutePolicy(routePattern).kind !== "unconfigured";
}

export function isKnownAppPageFile(pageFile: string): boolean {
  const normalized = pageFile.replace(/\\/g, "/");
  const marker = "/src/app/";
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex === -1 || !normalized.endsWith("/page.tsx")) {
    return false;
  }
  const routePattern =
    "/" +
    normalized
      .slice(markerIndex + marker.length, -"/page.tsx".length)
      .replace(/\/\[id\]/gu, "/[id]")
      .replace(/\/\[\.\.\.[^\]]+\]/gu, "");
  return getAppRoutePolicy(routePattern === "/" ? "/" : routePattern).kind !== "unconfigured";
}
