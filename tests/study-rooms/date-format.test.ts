import test from "node:test";
import assert from "node:assert/strict";

import { formatStudyRoomDateTime, formatStudyRoomTime } from "../../src/lib/study-rooms/date-format";

test("study room date formatting is deterministic IST text", () => {
  assert.equal(formatStudyRoomDateTime("2026-04-29T17:54:24.000Z"), "29 Apr 2026, 11:24 PM");
});

test("study room time formatting pads minutes without locale dependency", () => {
  assert.equal(formatStudyRoomTime("2026-04-29T03:05:00.000Z"), "8:35 AM");
});

test("study room date formatting handles invalid input", () => {
  assert.equal(formatStudyRoomDateTime("not-a-date"), "Unknown time");
  assert.equal(formatStudyRoomTime("not-a-date"), "Unknown time");
});
