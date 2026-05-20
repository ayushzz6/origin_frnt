import test from "node:test";
import assert from "node:assert/strict";

import { JoinCodeError } from "../../src/server/workspaces/join";
import { normalizeCode } from "../../src/server/workspaces/codes";

test("JoinCodeError carries the right status code", () => {
  const err = new JoinCodeError(404, "not found");
  assert.equal(err.status, 404);
  assert.equal(err.message, "not found");
});

test("normalizeCode produces a stable key for join lookups", () => {
  assert.equal(normalizeCode("origin_jee 12"), "ORIGIN-JEE-12");
  assert.equal(normalizeCode("origin-jee-12"), "ORIGIN-JEE-12");
  assert.equal(normalizeCode("---ORIGIN___JEE---12---"), "ORIGIN-JEE-12");
});
