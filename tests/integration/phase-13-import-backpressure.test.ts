/**
 * Phase 13 — backpressure integration test.
 *
 * Verifies createImportJob refuses with ImportJobBackpressureError
 * (status 429, errorCode IMPORT_JOB_BACKPRESSURE) once the per-workspace
 * concurrency cap is reached, and admits jobs again after one of the
 * active jobs transitions to a terminal status.
 *
 * The cap is overridden to 2 via DOCUMENT_IMPORT_WORKSPACE_CONCURRENCY
 * for the duration of the test so we don't have to seed 5+ jobs.
 *
 * Skipped when USER_DATABASE_URL isn't configured (plain CI).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  createImportJob,
  ImportJobBackpressureError,
  updateJobStatusService,
} from "@/server/workspaces/document-import-service";

import { cleanup, closePool, dbConfigured, seedFixtures } from "./_db";

const SKIP = !dbConfigured();

test(
  "phase 13: workspace concurrency cap rejects N+1 with ImportJobBackpressureError",
  { skip: SKIP },
  async () => {
    const previous = process.env.DOCUMENT_IMPORT_WORKSPACE_CONCURRENCY;
    process.env.DOCUMENT_IMPORT_WORKSPACE_CONCURRENCY = "2";
    const fx = await seedFixtures();
    try {
      const job1 = await createImportJob({
        workspaceId: fx.workspaceId,
        userId: fx.ownerId,
        sourceType: "pdf",
        fileName: "bp1.pdf",
        triggerPipeline: false,
      });
      const job2 = await createImportJob({
        workspaceId: fx.workspaceId,
        userId: fx.ownerId,
        sourceType: "pdf",
        fileName: "bp2.pdf",
        triggerPipeline: false,
      });
      assert.equal(job1.status, "queued");
      assert.equal(job2.status, "queued");

      await assert.rejects(
        createImportJob({
          workspaceId: fx.workspaceId,
          userId: fx.ownerId,
          sourceType: "pdf",
          fileName: "bp3.pdf",
          triggerPipeline: false,
        }),
        (err: unknown) => {
          assert.ok(err instanceof ImportJobBackpressureError, "should be backpressure error");
          assert.equal(err.status, 429);
          assert.equal(err.errorCode, "IMPORT_JOB_BACKPRESSURE");
          assert.equal(err.active, 2);
          assert.equal(err.cap, 2);
          return true;
        },
      );

      // Move one of the active jobs to a terminal state — backpressure
      // should release.
      await updateJobStatusService({
        workspaceId: fx.workspaceId,
        jobId: job1.id,
        userId: fx.ownerId,
        status: "succeeded",
        extra: { completedAt: new Date().toISOString() },
      });

      const job3 = await createImportJob({
        workspaceId: fx.workspaceId,
        userId: fx.ownerId,
        sourceType: "pdf",
        fileName: "bp4.pdf",
        triggerPipeline: false,
      });
      assert.equal(job3.status, "queued");
    } finally {
      if (previous === undefined) delete process.env.DOCUMENT_IMPORT_WORKSPACE_CONCURRENCY;
      else process.env.DOCUMENT_IMPORT_WORKSPACE_CONCURRENCY = previous;
      await cleanup(fx);
      await closePool();
    }
  },
);
