/**
 * Phase 14 — collaboration lifecycle (request → approve → pause) and the
 * active-collaborator gate that lights up both enrollment flows.
 *
 * Runs only when USER_DATABASE_URL is configured (CI + opt-in local).
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.TEACHER_LAUNCH_TEACHER_CONNECT = "1";

import {
  approveCollaboration,
  getCollaboration,
  isActiveCollaborator,
  requestCollaboration,
  setCollaborationStatusService,
} from "@/server/connect/collaboration-service";

import { cleanup, closePool, dbConfigured, seedFixtures } from "./_db";

const SKIP = !dbConfigured();
const it = test;

it("phase 14: collaboration request → approve → pause gates both flows", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  try {
    // Not a collaborator until requested + approved.
    assert.equal(await isActiveCollaborator(fx.workspaceId), false);

    const requested = await requestCollaboration({
      workspaceId: fx.workspaceId,
      actorUserId: fx.ownerId,
    });
    assert.equal(requested.status, "pending");
    assert.equal(await isActiveCollaborator(fx.workspaceId), false, "pending is not active");

    // Re-request is idempotent (still one pending row).
    const reRequested = await requestCollaboration({
      workspaceId: fx.workspaceId,
      actorUserId: fx.ownerId,
    });
    assert.equal(reRequested.id, requested.id);

    const approved = await approveCollaboration({
      workspaceId: fx.workspaceId,
      adminUserId: fx.ownerId,
    });
    assert.equal(approved.status, "active");
    assert.ok(approved.approvedAt, "approvedAt stamped on activation");
    assert.equal(await isActiveCollaborator(fx.workspaceId), true);

    // Pausing turns both flows off again.
    await setCollaborationStatusService({
      workspaceId: fx.workspaceId,
      status: "paused",
      adminUserId: fx.ownerId,
    });
    assert.equal(await isActiveCollaborator(fx.workspaceId), false);
    const current = await getCollaboration(fx.workspaceId);
    assert.equal(current?.status, "paused");
  } finally {
    await cleanup(fx);
  }
});

test.after(async () => {
  if (!SKIP) await closePool();
});
