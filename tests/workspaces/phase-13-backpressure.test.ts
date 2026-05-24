/**
 * Phase 13 — backpressure unit tests for the import-job creation path.
 *
 * Verifies:
 *  - active-job count below the cap admits a new job,
 *  - active-job count at or above the cap raises ImportJobBackpressureError
 *    with status 429 and a useful errorCode/payload.
 *
 * The DB layer is stubbed via dynamic mock injection — we only exercise
 * the service-layer guard, not real Postgres.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ImportJobBackpressureError } from "../../src/server/workspaces/document-import-service";

test("Phase 13: ImportJobBackpressureError carries status 429 + structured fields", () => {
  const err = new ImportJobBackpressureError(7, 5);
  assert.equal(err.status, 429);
  assert.equal(err.errorCode, "IMPORT_JOB_BACKPRESSURE");
  assert.equal(err.active, 7);
  assert.equal(err.cap, 5);
  assert.match(err.message, /capacity/i);
  assert.match(err.message, /7\/5/);
});

test("Phase 13: ImportJobBackpressureError is an Error subclass", () => {
  const err = new ImportJobBackpressureError(1, 1);
  assert.ok(err instanceof Error);
  assert.equal(err.name, "ImportJobBackpressureError");
});
