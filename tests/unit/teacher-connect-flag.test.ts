/**
 * Phase 14 unit — the teacherConnect feature flag. After the teacher-launch
 * phases shipped and were enabled in production, its default was flipped ON
 * (dev + prod) to remove the silent dark default; the env var still overrides
 * per-environment. No DB.
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

test("teacherConnect is enabled by default (no longer dark)", () => {
  withEnv(undefined, () => {
    assert.equal(isFeatureEnabled("teacherConnect"), true);
  });
});

test("teacherConnect can be overridden via the env var", () => {
  withEnv("1", () => {
    assert.equal(isFeatureEnabled("teacherConnect"), true);
  });
  withEnv("0", () => {
    assert.equal(isFeatureEnabled("teacherConnect"), false);
  });
});
