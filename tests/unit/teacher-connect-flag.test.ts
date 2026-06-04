/**
 * Phase 14 unit — the teacherConnect feature flag ships dark (off in dev + prod)
 * and is enable-able via TEACHER_LAUNCH_TEACHER_CONNECT. No DB.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { isFeatureEnabled } from "../../src/lib/feature-flags";

function withEnv(value: string | undefined, fn: () => void) {
  const before = process.env.TEACHER_LAUNCH_TEACHER_CONNECT;
  if (value === undefined) delete process.env.TEACHER_LAUNCH_TEACHER_CONNECT;
  else process.env.TEACHER_LAUNCH_TEACHER_CONNECT = value;
  try {
    fn();
  } finally {
    if (before === undefined) delete process.env.TEACHER_LAUNCH_TEACHER_CONNECT;
    else process.env.TEACHER_LAUNCH_TEACHER_CONNECT = before;
  }
}

test("teacherConnect ships dark by default (off in dev)", () => {
  withEnv(undefined, () => {
    assert.equal(isFeatureEnabled("teacherConnect"), false);
  });
});

test("teacherConnect can be enabled via the env var", () => {
  withEnv("1", () => {
    assert.equal(isFeatureEnabled("teacherConnect"), true);
  });
  withEnv("0", () => {
    assert.equal(isFeatureEnabled("teacherConnect"), false);
  });
});
