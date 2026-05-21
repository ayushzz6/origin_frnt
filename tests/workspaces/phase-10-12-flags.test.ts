import test from "node:test";
import assert from "node:assert/strict";

import { isFeatureEnabled } from "../../src/lib/feature-flags";

test("Phase 10-12: documentImport flag exists", () => {
  assert.equal(typeof isFeatureEnabled("documentImport"), "boolean");
});

test("Phase 10-12: adminControlCenter flag exists", () => {
  assert.equal(typeof isFeatureEnabled("adminControlCenter"), "boolean");
});

test("Phase 10-12: paidEnrollment flag exists", () => {
  assert.equal(typeof isFeatureEnabled("paidEnrollment"), "boolean");
});
