import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  PUBLIC_API_PATHS,
  PUBLIC_APP_PATHS,
  getApiRoutePolicy,
  getAppRoutePolicy,
  isKnownApiRouteFile,
  isKnownAppPageFile,
} from "../src/server/route-policy";

const root = new URL("..", import.meta.url).pathname;

function walkFiles(dir: string, predicate: (file: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      out.push(...walkFiles(path, predicate));
    } else if (predicate(path)) {
      out.push(path);
    }
  }
  return out;
}

test("all API route handlers are covered by explicit route policy", () => {
  const routes = walkFiles(join(root, "src/app/api"), (file) => file.endsWith("/route.ts"));
  const uncovered = routes.filter((route) => !isKnownApiRouteFile(route));
  assert.deepEqual(uncovered, []);
});

test("all app page sections are covered by public/authenticated/admin route policy", () => {
  const pages = walkFiles(join(root, "src/app"), (file) => file.endsWith("/page.tsx"));
  const uncovered = pages.filter((page) => !isKnownAppPageFile(page));
  assert.deepEqual(uncovered, []);
});

test("future API routes are denied by default", () => {
  assert.equal(getApiRoutePolicy("/api/new-feature").kind, "unconfigured");
  assert.equal(getAppRoutePolicy("/new-feature").kind, "unconfigured");
});

test("public API allowlist is limited to health, auth entrypoints, and the drain receiver", () => {
  assert.deepEqual([...PUBLIC_API_PATHS].sort(), [
    "/api/health",
    "/api/internal/observability/drain",
    "/api/users/google-login",
    "/api/users/login",
    "/api/users/register",
    "/api/users/token/refresh",
  ]);
});

test("auth refresh page route is public for expired access-cookie recovery", () => {
  assert.equal(getAppRoutePolicy("/auth/refresh").kind, "public");
  assert.ok((PUBLIC_APP_PATHS as readonly string[]).includes("/auth/refresh"));
});

test("route handlers do not import low-level JWT primitives directly", () => {
  const routes = walkFiles(join(root, "src/app/api"), (file) => file.endsWith("/route.ts"));
  const offenders = routes.filter((route) => readFileSync(route, "utf8").includes("@/server/auth-jwt"));
  assert.deepEqual(offenders, []);
});

test("known protected policies classify role and room-scoped routes", () => {
  assert.deepEqual(getAppRoutePolicy("/admin/users"), { kind: "role", roles: ["admin"] });
  assert.equal(getApiRoutePolicy("/api/study-rooms/room_1/messages").kind, "membership");
  assert.equal(getApiRoutePolicy("/api/origin-ai/chat").kind, "authenticated");
  assert.equal(getApiRoutePolicy("/api/internal/refresh-catalog").kind, "internal");
  assert.equal(getAppRoutePolicy("/videos/Instant-Doubt-Resolution.mp4").kind, "public");
  assert.equal(getAppRoutePolicy("/books/12/Biology/Chapter%201.pdf").kind, "authenticated");
});
