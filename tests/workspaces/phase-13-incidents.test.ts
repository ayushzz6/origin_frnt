/**
 * Phase 13 — incident control unit tests.
 *
 * Tests the in-memory fallback path (Redis unconfigured) so they can
 * run in plain unit-test CI. Verifies:
 *  - flag overrides round-trip via setFlagOverride/getFlagOverride;
 *  - setFlagOverride("clear") removes the override;
 *  - kill-switch path matching uses the FLAG_KILL_PREFIXES table;
 *  - rate-limit mode round-trips and divisor() returns the right scalar;
 *  - lockdown mode is recognised by isLockdown();
 *  - the snapshot is rebuilt after a mutation (no stale read).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  FLAG_KILL_PREFIXES,
  findKillSwitchForPath,
  getFlagOverride,
  getIncidentSnapshot,
  getRateLimitMode,
  isLockdown,
  rateLimitDivisor,
  setFlagOverride,
  setRateLimitMode,
  type RateLimitMode,
} from "../../src/server/incidents";

test("Phase 13: setFlagOverride('off') is read back as false", async () => {
  await setFlagOverride("teacherTests", "off");
  const v = await getFlagOverride("teacherTests");
  assert.equal(v, false);
  await setFlagOverride("teacherTests", "clear");
});

test("Phase 13: setFlagOverride('on') is read back as true", async () => {
  await setFlagOverride("teacherRooms", "on");
  const v = await getFlagOverride("teacherRooms");
  assert.equal(v, true);
  await setFlagOverride("teacherRooms", "clear");
});

test("Phase 13: setFlagOverride('clear') removes the override", async () => {
  await setFlagOverride("studyMaterials", "off");
  await setFlagOverride("studyMaterials", "clear");
  const v = await getFlagOverride("studyMaterials");
  assert.equal(v, null);
});

test("Phase 13: findKillSwitchForPath matches a killed flag's prefix", async () => {
  await setFlagOverride("documentImport", "off");
  const matched = await findKillSwitchForPath("/api/admin/import-jobs");
  assert.equal(matched, "documentImport");
  // Unrelated path shouldn't match
  const unrelated = await findKillSwitchForPath("/api/users/login");
  assert.equal(unrelated, null);
  await setFlagOverride("documentImport", "clear");
});

test("Phase 13: findKillSwitchForPath ignores 'forced on' overrides", async () => {
  await setFlagOverride("documentImport", "on");
  const matched = await findKillSwitchForPath("/api/admin/import-jobs");
  assert.equal(matched, null);
  await setFlagOverride("documentImport", "clear");
});

// Audit fix R-6 (A-18): documentImport used to list
// `/api/teacher/workspaces` as a kill prefix, which over-matched —
// killing it took down questions/tests/rooms too. The matcher is now
// a function scoped to the `/import-jobs` segment.
test("R-6 A-18: documentImport kill-switch is scoped to import-jobs", async () => {
  await setFlagOverride("documentImport", "off");
  // Should match
  assert.equal(
    await findKillSwitchForPath("/api/teacher/workspaces/ws_x/import-jobs"),
    "documentImport",
  );
  assert.equal(
    await findKillSwitchForPath("/api/teacher/workspaces/ws_x/import-jobs/job_y"),
    "documentImport",
  );
  assert.equal(
    await findKillSwitchForPath("/api/admin/import-jobs"),
    "documentImport",
  );
  assert.equal(
    await findKillSwitchForPath("/api/admin/import-jobs/job_y"),
    "documentImport",
  );
  // Should NOT match — sibling teacher surfaces stay up
  assert.equal(
    await findKillSwitchForPath("/api/teacher/workspaces/ws_x/questions"),
    null,
  );
  assert.equal(
    await findKillSwitchForPath("/api/teacher/workspaces/ws_x/tests"),
    null,
  );
  assert.equal(
    await findKillSwitchForPath("/api/teacher/workspaces/ws_x/rooms"),
    null,
  );
  assert.equal(
    await findKillSwitchForPath("/api/teacher/workspaces"),
    null,
  );
  await setFlagOverride("documentImport", "clear");
});

test("Phase 13: rate-limit mode round-trips", async () => {
  for (const mode of ["relaxed", "normal", "strict", "lockdown"] as RateLimitMode[]) {
    await setRateLimitMode(mode);
    assert.equal(await getRateLimitMode(), mode);
  }
  await setRateLimitMode("normal");
});

test("Phase 13: rateLimitDivisor returns expected scalars", () => {
  assert.equal(rateLimitDivisor("relaxed"), 0.5);
  assert.equal(rateLimitDivisor("normal"), 1);
  assert.equal(rateLimitDivisor("strict"), 2);
  assert.equal(rateLimitDivisor("lockdown"), Number.POSITIVE_INFINITY);
});

test("Phase 13: isLockdown only matches lockdown", () => {
  assert.equal(isLockdown("lockdown"), true);
  assert.equal(isLockdown("strict"), false);
  assert.equal(isLockdown("normal"), false);
  assert.equal(isLockdown("relaxed"), false);
});

test("Phase 13: getIncidentSnapshot reflects mutations", async () => {
  await setFlagOverride("paidEnrollment", "off");
  await setRateLimitMode("strict");
  const snap = await getIncidentSnapshot();
  assert.equal(snap.flagOverrides.paidEnrollment, false);
  assert.equal(snap.rateLimitMode, "strict");
  await setFlagOverride("paidEnrollment", "clear");
  await setRateLimitMode("normal");
});

test("Phase 13: every kill-switch entry references a real flag", () => {
  for (const flag of Object.keys(FLAG_KILL_PREFIXES)) {
    const matcher = FLAG_KILL_PREFIXES[flag as keyof typeof FLAG_KILL_PREFIXES];
    assert.ok(matcher !== undefined, `flag ${flag} has a matcher`);
    if (Array.isArray(matcher)) {
      assert.ok(matcher.length > 0, `flag ${flag} has at least one prefix`);
      for (const p of matcher) {
        assert.match(p, /^\/api\//, `prefix ${p} should be an /api/ path`);
      }
    } else {
      assert.equal(typeof matcher, "function", `flag ${flag} matcher is callable`);
    }
  }
});
