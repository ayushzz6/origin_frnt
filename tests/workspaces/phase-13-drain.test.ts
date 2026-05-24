/**
 * Phase 13 — drain receiver unit tests.
 *
 * Tests the helpers exported via __test (HMAC signature compute,
 * timing-safe hex compare, NDJSON / JSON-array event counting). No
 * Postgres or Redis required.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { __test } from "../../src/app/api/internal/observability/drain/route";

const SECRET = "super-secret-drain-token";

test("Phase 13 drain: computeSignature matches reference HMAC-SHA1", () => {
  const body = `{"events":[{"id":1}]}`;
  const expected = createHmac("sha1", SECRET).update(body).digest("hex");
  assert.equal(__test.computeSignature(SECRET, body), expected);
});

test("Phase 13 drain: timingSafeHexEqual returns true for matching hex", () => {
  const a = "deadbeef";
  const b = "deadbeef";
  assert.equal(__test.timingSafeHexEqual(a, b), true);
});

test("Phase 13 drain: timingSafeHexEqual returns false on mismatch", () => {
  assert.equal(__test.timingSafeHexEqual("deadbeef", "deadbeec"), false);
  // Different length must short-circuit safely.
  assert.equal(__test.timingSafeHexEqual("dead", "deadbeef"), false);
  assert.equal(__test.timingSafeHexEqual("", "deadbeef"), false);
});

test("Phase 13 drain: eventCount handles JSON arrays", () => {
  assert.equal(__test.eventCount("[]"), 0);
  assert.equal(__test.eventCount(`[{"a":1},{"b":2},{"c":3}]`), 3);
});

test("Phase 13 drain: eventCount handles NDJSON", () => {
  const ndjson = `{"a":1}\n{"b":2}\n{"c":3}\n`;
  assert.equal(__test.eventCount(ndjson), 3);
});

test("Phase 13 drain: eventCount returns 0 for empty bodies and 'unknown' for malformed", () => {
  assert.equal(__test.eventCount(""), 0);
  assert.equal(__test.eventCount("   \n   "), 0);
  // Malformed JSON array — should fall back to "unknown" per the
  // contract documented in the route.
  assert.equal(__test.eventCount("[ this is not json"), "unknown");
});
