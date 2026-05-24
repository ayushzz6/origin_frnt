/**
 * Phase 10 integration tests — import-job lifecycle:
 *   - createImportJob seeds the plan columns (target_surface, requested_by)
 *   - list returns the new job
 *   - update transitions stage/status/diagnostics in place
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  createImportJob,
  getJobWithProgress,
  listWorkspaceImportJobs,
  updateJobStatusService,
} from "@/server/workspaces/document-import-service";

import { cleanup, closePool, dbConfigured, seedFixtures } from "./_db";

const SKIP = !dbConfigured();
const it = test;

it(
  "phase 10: createImportJob persists plan columns + lists in workspace queue",
  { skip: SKIP },
  async () => {
    const fx = await seedFixtures();
    try {
      const job = await createImportJob({
        workspaceId: fx.workspaceId,
        userId: fx.ownerId,
        sourceType: "pdf",
        fileName: "test.pdf",
        mimeType: "application/pdf",
        targetSurface: "question_bag",
        requestedQuestionCount: 30,
        triggerPipeline: false, // don't try to hit the worker in tests
      });
      assert.equal(job.targetSurface, "question_bag");
      assert.equal(job.requestedQuestionCount, 30);
      assert.equal(job.requestedBy, fx.ownerId);
      assert.equal(job.stage, "queued");
      assert.equal(job.status, "queued");

      const jobs = await listWorkspaceImportJobs(fx.workspaceId, { limit: 10 });
      assert.ok(jobs.some((j) => j.id === job.id));

      const progress = await getJobWithProgress(fx.workspaceId, job.id);
      assert.ok(progress);
      assert.equal(progress!.id, job.id);
      assert.equal(progress!.progressPercent, 0);
    } finally {
      await cleanup(fx);
    }
  },
);

it(
  "phase 10: updateJobStatusService transitions stage + status atomically",
  { skip: SKIP },
  async () => {
    const fx = await seedFixtures();
    try {
      const job = await createImportJob({
        workspaceId: fx.workspaceId,
        userId: fx.ownerId,
        sourceType: "pdf",
        fileName: "lifecycle.pdf",
        mimeType: "application/pdf",
        triggerPipeline: false,
      });

      const after = await updateJobStatusService({
        workspaceId: fx.workspaceId,
        jobId: job.id,
        userId: fx.ownerId,
        status: "needs_review",
        extra: {
          totalPages: 5,
          processedPages: 5,
          totalQuestions: 25,
          acceptedQuestions: 20,
          reviewRequiredQuestions: 5,
        },
      });
      assert.ok(after);
      assert.equal(after!.status, "needs_review");
      assert.equal(after!.totalQuestions, 25);
      assert.equal(after!.acceptedQuestions, 20);
    } finally {
      await cleanup(fx);
    }
  },
);

test.after(async () => {
  if (!SKIP) await closePool();
});
