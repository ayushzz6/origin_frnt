import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeCode,
  validateCodeFormat,
  WorkspaceCodeError,
} from "../../src/server/workspaces/codes";

test("study materials: validateCodeFormat blocks reserved + offensive codes", () => {
  assert.throws(() => validateCodeFormat("ORIGIN"), WorkspaceCodeError);
  assert.throws(() => validateCodeFormat("ADMIN"), WorkspaceCodeError);
  assert.throws(() => validateCodeFormat("fuck-class"), WorkspaceCodeError);
});

test("study materials: normalizeCode uppercases and collapses non-alphanumeric runs", () => {
  assert.equal(normalizeCode("akash phy 12"), "AKASH-PHY-12");
  assert.equal(normalizeCode("  origin__jee   "), "ORIGIN-JEE");
  assert.equal(normalizeCode("ab-cd"), "AB-CD");
});

test("study materials: validateCodeFormat allows valid codes", () => {
  assert.equal(validateCodeFormat("akash-jee-12"), "AKASH-JEE-12");
  assert.equal(validateCodeFormat("ADMIN-CLASS"), "ADMIN-CLASS");
});

test("study materials: validateCodeFormat blocks too short / too long", () => {
  assert.throws(() => validateCodeFormat("ab"), WorkspaceCodeError);
  assert.throws(() => validateCodeFormat("x".repeat(64)), WorkspaceCodeError);
});
