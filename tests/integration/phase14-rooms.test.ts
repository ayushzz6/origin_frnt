/**
 * Phase 14 (2D) — teacher rooms → student.
 *
 * Covers: the teacher_test_id → room engine bridge (a teacher_room resolves an
 * assessment.tests id over the ogcode bank, and startRoomTest reads its duration
 * from assessment.tests); the membership-gated join (an active batch member joins
 * without an invite code, an outsider is 403'd); and the joinable-rooms listing
 * surfaced in /connect.
 *
 * Runs only when USER_DATABASE_URL is configured (CI + opt-in local). Pins the
 * OGCODE/rooms pool to the same DSN so the rooms, app and assessment schemas share
 * one physical DB — the production topology the teacher_room→batch FK assumes.
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.TEACHER_LAUNCH_TEACHER_CONNECT = "1";
if (process.env.USER_DATABASE_URL) {
  process.env.OGCODE_DATABASE_URL = process.env.OGCODE_DATABASE_URL ?? process.env.USER_DATABASE_URL;
}

import { AuthzError } from "@/server/authz";
import type { StoredUser } from "@/server/store";
import { getRoomSummaryById, startRoomTest } from "@/server/study-rooms";
import { addStudentsToBatches } from "@/server/workspaces/batches";
import { addQuestionToTest, createTest, getTeacherTestForRoom } from "@/server/workspaces/tests-store";
import { createTeacherRoom, listJoinableRoomsForStudent } from "@/server/workspaces/teacher-rooms";
import { joinConnectRoomByMembership } from "@/server/connect/connect-rooms-service";

import { cleanup, closePool, dbConfigured, makeId, rawPool, seedFixtures } from "./_db";

const SKIP = !dbConfigured();
const it = test;

function asStoredUser(id: string, name: string): StoredUser {
  return { id, name, role: "student" } as unknown as StoredUser;
}

it("phase 14: teacher-room bridge + membership-gated join + joinable listing", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  const outsiderId = makeId("user_outsider");
  let roomId: string | null = null;

  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, role, password_hash) VALUES ($1, 'Outsider', $2, 'student', 'test-no-login')
     ON CONFLICT (id) DO NOTHING`,
    [outsiderId, `${outsiderId}@example.com`],
  );

  try {
    await addStudentsToBatches({
      workspaceId: fx.workspaceId,
      batchIds: [fx.batchId],
      studentIds: [fx.studentId],
      assignedBy: null,
    });

    // A published teacher test backed by one ogcode question.
    const teacherTest = await createTest({
      workspaceId: fx.workspaceId,
      createdBy: fx.ownerId,
      title: "Room Physics Sprint",
      subject: "physics",
      durationMinutes: 20,
      totalQuestions: 1,
      status: "published",
    });
    await addQuestionToTest({
      testId: teacherTest.id,
      position: 0,
      sourceBank: "ogcode",
      ogcodeQuestionId: "ogq_phase14_rooms",
    });

    // The bridge resolver: an assessment.tests id resolves with its ogcode ids,
    // independent of any assignment (room membership is the gate).
    const resolved = await getTeacherTestForRoom(teacherTest.id);
    assert.ok(resolved, "teacher test resolves for a room");
    assert.deepEqual(resolved?.orderedQuestionIds, ["ogq_phase14_rooms"]);

    // Create a teacher room bound to the batch + test.
    const room = await createTeacherRoom({
      workspaceId: fx.workspaceId,
      createdBy: fx.ownerId,
      name: "Live Physics Room",
      batchId: fx.batchId,
      teacherTestId: teacherTest.id,
      roomKind: "teacher_room",
    });
    roomId = room.id;

    const summary = await getRoomSummaryById(room.id);
    assert.equal(summary?.room_kind, "teacher_room");
    assert.equal(summary?.teacher_test_id, teacherTest.id);
    assert.equal(summary?.workspace_id, fx.workspaceId);
    assert.equal(summary?.batch_id, fx.batchId);
    assert.equal(summary?.custom_test_id, null, "teacher rooms have no custom_test_id");

    // Joinable-rooms listing: visible to the batch member, hidden from the outsider.
    const joinable = await listJoinableRoomsForStudent(fx.studentId);
    assert.ok(joinable.some((r) => r.id === room.id), "batch member sees the live room");
    const outsiderJoinable = await listJoinableRoomsForStudent(outsiderId);
    assert.equal(outsiderJoinable.find((r) => r.id === room.id), undefined, "outsider does not see it");

    // Membership-gated join: outsider rejected, member admitted.
    await assert.rejects(
      () => joinConnectRoomByMembership(room.id, asStoredUser(outsiderId, "Outsider")),
      (err: unknown) => err instanceof AuthzError && err.status === 403,
      "outsider cannot join by membership",
    );
    const joined = await joinConnectRoomByMembership(room.id, asStoredUser(fx.studentId, "Test Student"));
    assert.equal(joined.id, room.id, "batch member joins by membership");

    // Bridge: the teacher (room admin participant) starts → engine resolves the
    // duration from assessment.tests (20 min) and flips status to in_test.
    const event = await startRoomTest(room.id, fx.ownerId);
    assert.equal(event.duration_seconds, 20 * 60, "duration resolved from assessment.tests");
    const started = await getRoomSummaryById(room.id);
    assert.equal(started?.status, "in_test");
  } finally {
    if (roomId) await rawPool().query(`DELETE FROM rooms.rooms WHERE id = $1`, [roomId]);
    await rawPool().query(`DELETE FROM origin_users WHERE id = $1`, [outsiderId]);
    await cleanup(fx);
  }
});

test.after(async () => {
  if (!SKIP) await closePool();
});
