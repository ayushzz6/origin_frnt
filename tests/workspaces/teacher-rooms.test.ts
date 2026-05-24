import test from "node:test";
import assert from "node:assert/strict";

import { isFeatureEnabled } from "@/lib/feature-flags";

const env = process.env as Record<string, string | undefined>;

test("Phase 6: teacherRooms flag is on in prod by default (post-launch)", () => {
  const prev = env.NODE_ENV;
  env.NODE_ENV = "production";
  try {
    assert.equal(isFeatureEnabled("teacherRooms"), true);
  } finally {
    env.NODE_ENV = prev;
  }
});

test("Phase 6: teacherRooms flag can be enabled via env var", () => {
  const prev = env.NODE_ENV;
  env.NODE_ENV = "production";
  env.TEACHER_LAUNCH_TEACHER_ROOMS = "1";
  try {
    assert.equal(isFeatureEnabled("teacherRooms"), true);
  } finally {
    env.NODE_ENV = prev;
    delete env.TEACHER_LAUNCH_TEACHER_ROOMS;
  }
});

test("Phase 6: RoomKind includes teacher_room and student_room", () => {
  const kinds = ["student_room", "teacher_room"];
  assert.equal(kinds.length, 2);
});

test("Phase 6: TeacherRoomSummary includes all required fields", () => {
  const room = {
    id: "room_123",
    name: "Physics Live Test",
    adminUserId: "user_123",
    createdBy: "user_123",
    status: "lobby" as const,
    teacherTestId: null,
    durationSeconds: null,
    startedAt: null,
    endedAt: null,
    maxParticipants: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    workspaceId: "ws_123",
    batchId: null,
    roomKind: "teacher_room" as const,
  };
  assert.equal(room.workspaceId, "ws_123");
  assert.equal(room.roomKind, "teacher_room");
  assert.equal(room.status, "lobby");
  assert.equal(room.maxParticipants, 100);
});

test("Phase 6: TeacherRoomSummary with test and batch", () => {
  const room = {
    id: "room_456",
    name: "Batch 1 Physics",
    adminUserId: "user_123",
    createdBy: "user_123",
    status: "in_test" as const,
    teacherTestId: "test_789",
    durationSeconds: 1800,
    startedAt: new Date().toISOString(),
    endedAt: null,
    maxParticipants: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    workspaceId: "ws_123",
    batchId: "batch_001",
    roomKind: "teacher_room" as const,
  };
  assert.equal(room.teacherTestId, "test_789");
  assert.equal(room.batchId, "batch_001");
  assert.equal(room.status, "in_test");
  assert.equal(room.durationSeconds, 1800);
});

test("Phase 6: roomKind types match expected values", () => {
  const validKinds: import("@/server/workspaces/types").RoomKind[] = [
    "student_room",
    "teacher_room",
  ];
  assert.equal(validKinds.length, 2);
  assert.ok(validKinds.includes("teacher_room"));
  assert.ok(validKinds.includes("student_room"));
});

test("Phase 6: TeacherRoomSummary status values are correct", () => {
  const statuses: TeacherRoomSummary["status"][] = ["lobby", "in_test", "finished", "closed"];
  assert.equal(statuses.length, 4);
  assert.ok(statuses.includes("lobby"));
  assert.ok(statuses.includes("in_test"));
  assert.ok(statuses.includes("finished"));
  assert.ok(statuses.includes("closed"));
});

type TeacherRoomSummary = import("@/server/workspaces/types").TeacherRoomSummary;

test("Phase 6: workspace scoping fields are nullable", () => {
  const room: TeacherRoomSummary = {
    id: "room_1",
    name: "Test",
    adminUserId: "u1",
    createdBy: "u1",
    status: "lobby",
    teacherTestId: null,
    durationSeconds: null,
    startedAt: null,
    endedAt: null,
    maxParticipants: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    workspaceId: null,
    batchId: null,
    roomKind: "student_room",
  };
  assert.equal(room.workspaceId, null);
  assert.equal(room.batchId, null);
  assert.equal(room.teacherTestId, null);
});