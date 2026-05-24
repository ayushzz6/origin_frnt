/**
 * Phase 13 — permission fuzz tests.
 *
 * Exercises the pure `evaluateWorkspaceAccess` decision function across
 * the role × member-status × workspace-status × allowedRoles × is-member
 * cube. fast-check shrinks failures down to the simplest counterexample,
 * so a regression in the access matrix points at the exact tuple that
 * broke.
 *
 * Invariants (mirrored from src/server/workspaces/authz.ts):
 *  1. Platform admins (auth.role === "admin") bypass every check.
 *  2. Non-admins must be active members of the workspace.
 *  3. Non-admins on a non-operational workspace (suspended/closed) are
 *     refused even when they're active members.
 *  4. Members whose role is not in allowedRoles (when non-empty) are
 *     refused.
 *  5. isMutatingRoleAllowed() agrees with the route-level allowlist for
 *     mutation endpoints.
 */

import test from "node:test";
import assert from "node:assert/strict";

import fc from "fast-check";

import type { AuthContext } from "../../src/server/authz";
import {
  evaluateWorkspaceAccess,
  isMutatingRoleAllowed,
} from "../../src/server/workspaces/authz";
import type {
  TeacherWorkspace,
  WorkspaceMember,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
  WorkspaceStatus,
} from "../../src/server/workspaces/types";

const ROLES: WorkspaceMemberRole[] = [
  "owner",
  "admin",
  "teacher",
  "content_manager",
  "analyst",
  "support",
];
const MEMBER_STATUSES: WorkspaceMemberStatus[] = ["invited", "active", "disabled", "removed"];
const WS_STATUSES: WorkspaceStatus[] = ["active", "trial", "suspended", "closed"];

function fakeWorkspace(status: WorkspaceStatus): TeacherWorkspace {
  return {
    id: "ws_fuzz",
    workspaceType: "institute",
    ownerUserId: "user_owner",
    displayName: "Fuzz Workspace",
    legalName: null,
    slug: null,
    logoAssetId: null,
    city: null,
    state: null,
    country: "IN",
    subjects: [],
    courses: [],
    status,
    verificationStatus: "unverified",
    publicProfile: {},
    settings: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function fakeMember(
  role: WorkspaceMemberRole,
  status: WorkspaceMemberStatus,
): WorkspaceMember {
  return {
    workspaceId: "ws_fuzz",
    userId: "user_fuzz",
    role,
    status,
    invitedBy: null,
    joinedAt: status === "active" ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildAuth(role: AuthContext["role"]): AuthContext {
  return {
    userId: "user_fuzz",
    sessionId: "session_fuzz",
    role,
    tokenVersion: 0,
    jwtId: "jwt_fuzz",
    claims: {
      sub: "user_fuzz",
      sid: "session_fuzz",
      role,
      tokenVersion: 0,
      jti: "jwt_fuzz",
      fgpHash: "",
      iss: "origin-v1",
      aud: "origin-web",
      iat: 0,
      nbf: 0,
      exp: 0,
    } as AuthContext["claims"],
  };
}

test("Phase 13 fuzz: evaluateWorkspaceAccess is consistent with the documented invariants", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...ROLES),
      fc.constantFrom(...MEMBER_STATUSES),
      fc.constantFrom(...WS_STATUSES),
      fc.constantFrom("student", "teacher", "admin").map((r) => r as AuthContext["role"]),
      fc.subarray(ROLES, { minLength: 0, maxLength: ROLES.length }),
      fc.boolean(),
      (role, memberStatus, wsStatus, sessionRole, allowedRoles, isMember) => {
        const auth = buildAuth(sessionRole);
        const workspace = fakeWorkspace(wsStatus);
        const member = isMember ? fakeMember(role, memberStatus) : null;

        const decision = evaluateWorkspaceAccess({ auth, workspace, member, allowedRoles });
        const granted = decision === null;

        const platformAdmin = sessionRole === "admin";
        const operational = wsStatus === "active" || wsStatus === "trial";
        const activeMember = isMember && memberStatus === "active";
        const roleAllowed = allowedRoles.length === 0 || allowedRoles.includes(role);

        if (platformAdmin) {
          // Platform admins are subject to one rule only: the workspace
          // must exist (which it does in this test). They pass even on
          // suspended workspaces and even when not a member.
          assert.equal(granted, true, `platform admin should pass for ${JSON.stringify({ role, memberStatus, wsStatus, allowedRoles, isMember })}`);
          return;
        }

        if (!activeMember) {
          assert.equal(granted, false, "non-members must be refused");
          assert.equal(decision?.status, 403);
          return;
        }
        if (!operational) {
          assert.equal(granted, false, "non-operational workspace must refuse non-admins");
          assert.equal(decision?.status, 403);
          return;
        }
        if (!roleAllowed) {
          assert.equal(granted, false, "role not in allowedRoles must be refused");
          assert.equal(decision?.status, 403);
          return;
        }
        assert.equal(granted, true, "active member with allowed role must pass");
      },
    ),
    { numRuns: 600 },
  );
});

test("Phase 13 fuzz: isMutatingRoleAllowed agrees with the route-level mutation allowlist", () => {
  fc.assert(
    fc.property(fc.constantFrom(...ROLES), (role) => {
      const expected = ["owner", "admin", "teacher", "content_manager"].includes(role);
      assert.equal(isMutatingRoleAllowed(role), expected, `role=${role}`);
    }),
    { numRuns: 100 },
  );
});

test("Phase 13 fuzz: missing workspace always refuses", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("student", "teacher", "admin").map((r) => r as AuthContext["role"]),
      (sessionRole) => {
        const decision = evaluateWorkspaceAccess({
          auth: buildAuth(sessionRole),
          workspace: null,
          member: null,
        });
        assert.ok(decision);
        assert.equal(decision!.status, 403);
      },
    ),
    { numRuns: 50 },
  );
});
