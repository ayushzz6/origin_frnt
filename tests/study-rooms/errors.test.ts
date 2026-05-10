import test from "node:test";
import assert from "node:assert/strict";

import { isStudyRoomUnavailableError } from "../../src/lib/study-rooms/errors";

test("study room unavailable detection matches deleted room failures", () => {
  assert.equal(isStudyRoomUnavailableError(new Error("Study room was not found.")), true);
  assert.equal(isStudyRoomUnavailableError(new Error("You are not an active participant in this room.")), true);
  assert.equal(isStudyRoomUnavailableError(new Error("Room code is invalid or expired.")), true);
});

test("study room unavailable detection ignores unrelated errors", () => {
  assert.equal(isStudyRoomUnavailableError(new Error("Only the room admin can delete the room.")), false);
  assert.equal(isStudyRoomUnavailableError("Study room was not found."), false);
});
