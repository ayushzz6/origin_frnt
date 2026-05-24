import test from "node:test";
import assert from "node:assert/strict";

import { isFeatureEnabled, requireFeatureEnabled, FeatureDisabledError } from "../../src/lib/feature-flags";

function withEnv(name: string, value: string | undefined, fn: () => void) {
  const before = process.env[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
  try {
    fn();
  } finally {
    if (before === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = before;
    }
  }
}

test("workspaces flag respects explicit env override", () => {
  withEnv("TEACHER_LAUNCH_WORKSPACES", "true", () => {
    assert.equal(isFeatureEnabled("workspaces"), true);
  });
  withEnv("TEACHER_LAUNCH_WORKSPACES", "false", () => {
    assert.equal(isFeatureEnabled("workspaces"), false);
  });
});

test("orgCodes flag defaults on in production after launch", () => {
  // After all 13 phases shipped to production, defaultProd flipped to
  // true for every flag. Off-in-prod is now an explicit env override
  // (or the runtime kill-switch in /admin/incidents).
  const env = process.env as Record<string, string | undefined>;
  const original = env.NODE_ENV;
  env.NODE_ENV = "production";
  try {
    withEnv("TEACHER_LAUNCH_ORG_CODES", undefined, () => {
      assert.equal(isFeatureEnabled("orgCodes"), true);
    });
    withEnv("TEACHER_LAUNCH_ORG_CODES", "false", () => {
      assert.equal(isFeatureEnabled("orgCodes"), false);
    });
  } finally {
    if (original === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = original;
  }
});

test("requireFeatureEnabled throws FeatureDisabledError when off", () => {
  withEnv("TEACHER_LAUNCH_QUESTION_BAG", "false", () => {
    assert.throws(() => requireFeatureEnabled("questionBag"), FeatureDisabledError);
  });
});
