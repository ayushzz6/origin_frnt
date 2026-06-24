import test from "node:test";
import assert from "node:assert/strict";

import {
  PUBLIC_API_PATHS,
  getApiRoutePolicy,
  getAppRoutePolicy,
} from "../src/server/route-policy";

test("all /api/social/* routes are authenticated (student-only enforced in handlers)", () => {
  assert.equal(getApiRoutePolicy("/api/social/profile/[username]").kind, "authenticated");
  assert.equal(getApiRoutePolicy("/api/social/follow").kind, "authenticated");
  assert.equal(getApiRoutePolicy("/api/social/followers/[username]").kind, "authenticated");
  assert.equal(getApiRoutePolicy("/api/social/following/[username]").kind, "authenticated");
  assert.equal(getApiRoutePolicy("/api/social/search").kind, "authenticated");
});

test("social app surfaces require auth", () => {
  assert.equal(getAppRoutePolicy("/u/[username]").kind, "authenticated");
  assert.equal(getAppRoutePolicy("/u/rahul_k7q").kind, "authenticated");
  assert.equal(getAppRoutePolicy("/u/rahul_k7q/followers").kind, "authenticated");
  assert.equal(getAppRoutePolicy("/u/rahul_k7q/following").kind, "authenticated");
  assert.equal(getAppRoutePolicy("/social").kind, "authenticated");
});

test("no student-social route is public at the edge", () => {
  const publicPaths = PUBLIC_API_PATHS as readonly string[];
  assert.ok(!publicPaths.some((p) => p.startsWith("/api/social")));
});
