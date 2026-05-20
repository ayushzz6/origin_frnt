import test from "node:test";
import assert from "node:assert/strict";

import { getApiRoutePolicy, getAppRoutePolicy } from "../../src/server/route-policy";

test("teacher API surface is classified as authenticated", () => {
  assert.equal(getApiRoutePolicy("/api/teacher/workspaces").kind, "authenticated");
  assert.equal(
    getApiRoutePolicy("/api/teacher/workspaces/ws_123").kind,
    "authenticated",
  );
  assert.equal(
    getApiRoutePolicy("/api/teacher/workspaces/[workspaceId]").kind,
    "authenticated",
  );
});

test("enrollment endpoint is authenticated for students", () => {
  assert.equal(getApiRoutePolicy("/api/enrollments/join-code").kind, "authenticated");
});

test("teacher app pages are authenticated", () => {
  assert.equal(getAppRoutePolicy("/teacher").kind, "authenticated");
  assert.equal(getAppRoutePolicy("/teacher/onboarding").kind, "authenticated");
  assert.equal(
    getAppRoutePolicy("/teacher/workspaces/ws_123/students").kind,
    "authenticated",
  );
});
