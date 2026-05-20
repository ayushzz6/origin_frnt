import test from "node:test";
import assert from "node:assert/strict";

import {
  generateDefaultPersonalCode,
  normalizeCode,
  validateCodeFormat,
  WorkspaceCodeError,
} from "../../src/server/workspaces/codes";

test("normalizeCode uppercases and collapses non-alphanumeric runs", () => {
  assert.equal(normalizeCode("akash phy 12"), "AKASH-PHY-12");
  assert.equal(normalizeCode("  origin__jee   "), "ORIGIN-JEE");
  assert.equal(normalizeCode("ab-cd"), "AB-CD");
});

test("validateCodeFormat blocks too short / too long / invalid chars", () => {
  assert.throws(() => validateCodeFormat("ab"), WorkspaceCodeError);
  assert.throws(() => validateCodeFormat("x".repeat(64)), WorkspaceCodeError);
});

test("validateCodeFormat blocks reserved + offensive codes", () => {
  assert.throws(() => validateCodeFormat("ORIGIN"), WorkspaceCodeError);
  assert.throws(() => validateCodeFormat("ADMIN"), WorkspaceCodeError);
  assert.throws(() => validateCodeFormat("fuck-class"), WorkspaceCodeError);
});

test("validateCodeFormat allows reserved-substring-containing custom codes", () => {
  // ADMIN-CLASS contains 'ADMIN' but is not in the exact reserved set, so allowed.
  assert.equal(validateCodeFormat("ADMIN-CLASS"), "ADMIN-CLASS");
});

test("validateCodeFormat returns normalized representation", () => {
  assert.equal(validateCodeFormat("akash-jee-12"), "AKASH-JEE-12");
});

test("generateDefaultPersonalCode produces a valid normalized code", () => {
  const { display, normalized } = generateDefaultPersonalCode("Ms Sharma");
  assert.ok(normalized.length >= 4 && normalized.length <= 32, normalized);
  assert.match(normalized, /^[A-Z0-9-]+$/);
  assert.ok(display.includes("-"));
});
