import test from "node:test";
import assert from "node:assert/strict";

import {
  slugifyName,
  idSuffix,
  defaultUsernameFor,
  normalizeUsername,
  isValidUsername,
} from "../src/server/social/username";

test("slugifyName lowercases, strips non-alphanumerics, and caps at 15", () => {
  assert.equal(slugifyName("John Doe"), "johndoe");
  assert.equal(slugifyName("Ravi-Kumar (JEE)!"), "ravikumarjee");
  assert.equal(slugifyName("A Very Very Long Display Name"), "averyverylongdi");
  assert.equal(slugifyName("   "), "");
  assert.equal(slugifyName(null), "");
});

test("idSuffix returns the unique part after the first underscore", () => {
  assert.equal(idSuffix("user_abc123def456"), "abc123def456");
  assert.equal(idSuffix("USER_AB12"), "ab12");
  assert.equal(idSuffix("noseparator"), "noseparator");
});

test("defaultUsernameFor is deterministic and collision-free by id suffix", () => {
  assert.equal(defaultUsernameFor("John Doe", "user_abc123"), "johndoe_abc123");
  // Same name, different id → different handle.
  assert.notEqual(
    defaultUsernameFor("John Doe", "user_aaa"),
    defaultUsernameFor("John Doe", "user_bbb"),
  );
  // No usable name characters → falls back to the unique id.
  assert.equal(defaultUsernameFor("   ", "user_xyz"), "user_xyz");
  assert.equal(defaultUsernameFor("!!!", "user_xyz"), "user_xyz");
});

test("normalizeUsername strips invalid characters and lowercases", () => {
  assert.equal(normalizeUsername("  John.Doe! "), "johndoe");
  assert.equal(normalizeUsername("Ravi_Kumar_99"), "ravi_kumar_99");
  assert.equal(normalizeUsername("hi there"), "hithere");
});

test("isValidUsername enforces 3–30 lowercase/digit/underscore handles", () => {
  assert.equal(isValidUsername("john_doe"), true);
  assert.equal(isValidUsername("ab"), false); // too short
  assert.equal(isValidUsername("a".repeat(31)), false); // too long
  assert.equal(isValidUsername("John"), false); // uppercase
  assert.equal(isValidUsername("john doe"), false); // space
  assert.equal(isValidUsername("john.doe"), false); // dot
  assert.equal(isValidUsername("a_1"), true); // min length boundary
});
