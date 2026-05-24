/**
 * Phase 13 — import worker retry / resume test.
 *
 * Models the worker-crash-mid-pipeline scenario:
 *  1. Job is created and partially populated (some pages, some
 *     questions inserted) — this is what the worker leaves behind
 *     after a hard crash.
 *  2. The job is "re-run" by transitioning back to processing without
 *     deleting the partial pages/questions; the worker is responsible
 *     for resuming, not duplicating.
 *
 * The contract this test pins is on the storage layer: a re-run of
 * the same job_id MUST NOT duplicate pages or questions. We assert by
 * counting rows before and after a status round-trip.
 *
 * Skipped when USER_DATABASE_URL isn't configured (plain CI).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  addJobPage,
  addJobQuestion,
  createImportJob,
  updateImportJobStatus,
} from "@/server/workspaces/document-import-store";

import { cleanup, closePool, dbConfigured, rawPool, seedFixtures } from "./_db";

const SKIP = !dbConfigured();

test(
  "phase 13: re-running a partially-processed job does not duplicate pages or questions",
  { skip: SKIP },
  async () => {
    const fx = await seedFixtures();
    try {
      const job = await createImportJob({
        workspaceId: fx.workspaceId,
        userId: fx.ownerId,
        sourceType: "pdf",
        fileName: "retry.pdf",
      });

      const page1 = await addJobPage(job.id, 1, { status: "parsed", extractedText: "p1" });
      const page2 = await addJobPage(job.id, 2, { status: "parsed", extractedText: "p2" });
      const q1 = await addJobQuestion(job.id, page1.id, { questionText: "Q1", status: "accepted" });
      const q2 = await addJobQuestion(job.id, page2.id, { questionText: "Q2", status: "review_required" });

      await updateImportJobStatus(job.id, fx.workspaceId, "failed", {
        errorMessage: "worker crashed",
        completedAt: new Date().toISOString(),
      });

      // Re-run: worker transitions back to processing. Idempotent
      // resume — pages/questions already on disk should be re-used.
      await updateImportJobStatus(job.id, fx.workspaceId, "processing", {
        startedAt: new Date().toISOString(),
        completedAt: null,
      });

      const pages = await rawPool().query(
        `SELECT id FROM import.import_job_pages WHERE job_id = $1`,
        [job.id],
      );
      const questions = await rawPool().query(
        `SELECT id FROM import.import_job_questions WHERE job_id = $1`,
        [job.id],
      );

      assert.equal(pages.rowCount, 2, "pages should not be duplicated by status round-trip");
      assert.equal(questions.rowCount, 2, "questions should not be duplicated by status round-trip");

      const pageIds = pages.rows.map((r) => r.id).sort();
      assert.deepEqual(pageIds, [page1.id, page2.id].sort());
      const qIds = questions.rows.map((r) => r.id).sort();
      assert.deepEqual(qIds, [q1.id, q2.id].sort());
    } finally {
      await cleanup(fx);
      await closePool();
    }
  },
);
