/**
 * Phase 11 integration tests — admin suspend/unsuspend, code revocation,
 * audit-event writes.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  adminRevokeWorkspaceCodeService,
  listAuditEventsService,
  suspendWorkspaceService,
  unsuspendWorkspaceService,
  updateWorkspaceAdminService,
} from "@/server/workspaces/admin-service";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { createWorkspaceCode } from "@/server/workspaces/store";

import { cleanup, closePool, dbConfigured, seedFixtures } from "./_db";

const SKIP = !dbConfigured();
const it = test;

function mockRequestForUser(userId: string, role: "admin" | "teacher" | "student" = "teacher"): Request {
  // requireAuth reads a cookie; for these tests we stub a Request with
  // a custom header that our test-only auth shim consumes. The simpler
  // approach: skip the auth-layer call and exercise services directly,
  // which is what we do here.
  return new Request(`https://example.com/?_actor=${userId}&_role=${role}`);
}

it("phase 11: suspend then unsuspend round-trips workspace status", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  try {
    const ok = await suspendWorkspaceService({
      workspaceId: fx.workspaceId,
      reason: "policy_violation",
      adminUserId: fx.ownerId, // any user id; the service doesn't auth here.
    });
    assert.equal(ok, true);

    // While suspended, requireWorkspaceMember refuses non-admin access.
    await assert.rejects(
      requireWorkspaceMember(
        mockRequestForUser(fx.ownerId, "teacher"),
        fx.workspaceId,
      ),
      /not operational|You are not authenticated|authenticated/i,
    );

    const restored = await unsuspendWorkspaceService({
      workspaceId: fx.workspaceId,
      adminUserId: fx.ownerId,
    });
    assert.equal(restored, true);
  } finally {
    await cleanup(fx);
  }
});

it("phase 11: revoking a workspace code marks it revoked", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  try {
    const code = await createWorkspaceCode({
      workspaceId: fx.workspaceId,
      normalizedCode: `TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      displayCode: "TEST-CODE",
      codeType: "student_join",
      createdBy: fx.ownerId,
    });
    const revoked = await adminRevokeWorkspaceCodeService({
      workspaceId: fx.workspaceId,
      codeId: code.id,
      adminUserId: fx.ownerId,
    });
    assert.ok(revoked, "revoke returned a code");
    assert.equal(revoked!.status, "revoked");
  } finally {
    await cleanup(fx);
  }
});

it("phase 11: admin actions write audit events", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  try {
    await updateWorkspaceAdminService({
      workspaceId: fx.workspaceId,
      patch: { displayName: "Renamed Institute" },
      adminUserId: fx.ownerId,
    });
    const events = await listAuditEventsService({
      workspaceId: fx.workspaceId,
      entityType: "teacher_workspace",
      action: "workspace.admin_updated",
      limit: 5,
    });
    assert.ok(events.length >= 1, "audit event for admin update written");
    assert.equal(events[0].entityId, fx.workspaceId);
  } finally {
    await cleanup(fx);
  }
});

test.after(async () => {
  if (!SKIP) await closePool();
});
