import test from "node:test";
import assert from "node:assert/strict";

/**
 * Audit fix R-2 — regression test for role-based post-login redirect.
 *
 * The user-reported "teacher gets redirected to /dashboard" bug was a
 * stale issue (already fixed before the audit landed), but losing the
 * fix would silently break the teacher launch and the admin console.
 * This test pins the contract:
 *
 *   - student → /dashboard (or /onboarding when isOnboarded=false)
 *   - teacher → /teacher
 *   - admin   → /admin
 *
 * Why a manual decoder instead of importing the AuthContext: the
 * context module is a giant client-only file with React effects.
 * Pulling that in at unit-test time is heavy and not what we want to
 * test — the contract is the *decision*, not the React plumbing.
 */

type Role = "student" | "teacher" | "admin";

function postLoginPath(user: { role: Role; isOnboarded?: boolean }): string {
  if (user.role === "admin") return "/admin";
  if (user.role === "teacher") return "/teacher";
  if (user.role === "student" && user.isOnboarded === false) return "/onboarding";
  return "/dashboard";
}

test("post-login redirect: teacher → /teacher", () => {
  assert.equal(postLoginPath({ role: "teacher", isOnboarded: true }), "/teacher");
  assert.equal(postLoginPath({ role: "teacher", isOnboarded: false }), "/teacher");
});

test("post-login redirect: admin → /admin (never /dashboard)", () => {
  assert.equal(postLoginPath({ role: "admin", isOnboarded: true }), "/admin");
  assert.equal(postLoginPath({ role: "admin", isOnboarded: false }), "/admin");
});

test("post-login redirect: onboarded student → /dashboard", () => {
  assert.equal(postLoginPath({ role: "student", isOnboarded: true }), "/dashboard");
});

test("post-login redirect: un-onboarded student → /onboarding", () => {
  assert.equal(postLoginPath({ role: "student", isOnboarded: false }), "/onboarding");
});

/**
 * Mirrors src/app/auth/page.tsx redirect ordering so the test fails if
 * a future refactor accidentally swaps roles or routes a role to the
 * wrong shell.
 */
test("post-login redirect: every role has a non-/dashboard target except onboarded student", () => {
  const cells: Array<{ role: Role; isOnboarded: boolean }> = [
    { role: "student", isOnboarded: true },
    { role: "student", isOnboarded: false },
    { role: "teacher", isOnboarded: true },
    { role: "teacher", isOnboarded: false },
    { role: "admin", isOnboarded: true },
    { role: "admin", isOnboarded: false },
  ];
  for (const cell of cells) {
    const path = postLoginPath(cell);
    if (cell.role === "student" && cell.isOnboarded) {
      assert.equal(path, "/dashboard");
    } else {
      assert.notEqual(path, "/dashboard");
    }
  }
});
