import test from "node:test";
import assert from "node:assert/strict";

import { REFRESH_TOKEN_ROTATION_INTERVAL_MS, shouldRotateRefreshToken } from "../src/server/db-users";

test("refresh tokens are not rotated during routine access renewal", () => {
  const now = Date.now();
  assert.equal(shouldRotateRefreshToken(new Date(now - 60_000), new Date(now - 60_000), now), false);
  assert.equal(shouldRotateRefreshToken(null, new Date(now - 60_000), now), false);
});

test("refresh replay grace never triggers another refresh rotation", () => {
  const now = Date.now();
  assert.equal(
    shouldRotateRefreshToken(new Date(now - REFRESH_TOKEN_ROTATION_INTERVAL_MS - 1), new Date(now), now, true),
    false,
  );
});

test("refresh token rotation is reserved for long-lived sessions", () => {
  const now = Date.now();
  assert.equal(
    shouldRotateRefreshToken(new Date(now - REFRESH_TOKEN_ROTATION_INTERVAL_MS - 1), new Date(now), now),
    true,
  );
});
