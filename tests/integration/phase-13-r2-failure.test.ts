/**
 * Phase 13 — R2 fetch failure integration test.
 *
 * Simulates the worker reporting "R2 returned 5xx" by directly setting
 * status=failed and error_code='R2_FETCH_FAILED' on the job row (which
 * is exactly what document-import-service writes when it gets a 5xx
 * from R2 during source-file fetch). Verifies the read path surfaces
 * both the status and the error_code so the review UI can show a
 * useful message instead of a generic failure.
 *
 * Skipped when USER_DATABASE_URL isn't configured (plain CI).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createImportJob, getJobWithProgress } from "@/server/workspaces/document-import-service";

import { cleanup, closePool, dbConfigured, rawPool, seedFixtures } from "./_db";

const SKIP = !dbConfigured();

test(
  "phase 13: R2 fetch 5xx surfaces as status=failed + error_code=R2_FETCH_FAILED",
  { skip: SKIP },
  async () => {
    const fx = await seedFixtures();
    try {
      const job = await createImportJob({
        workspaceId: fx.workspaceId,
        userId: fx.ownerId,
        sourceType: "pdf",
        fileName: "r2-failure.pdf",
        triggerPipeline: false,
      });

      // Simulate what the worker writes when R2 returns 5xx during
      // source-file fetch. We hit error_code directly because the
      // updateImportJobStatus helper doesn't expose that column (it's
      // worker-owned).
      await rawPool().query(
        `UPDATE import.document_import_jobs
            SET status = 'failed',
                error_code = 'R2_FETCH_FAILED',
                error_message = 'R2 returned HTTP 503 for source object',
                completed_at = NOW(),
                updated_at = NOW()
          WHERE id = $1 AND workspace_id = $2`,
        [job.id, fx.workspaceId],
      );

      const progress = await getJobWithProgress(fx.workspaceId, job.id);
      assert.ok(progress);
      assert.equal(progress!.status, "failed");
      assert.equal(progress!.errorCode, "R2_FETCH_FAILED");
      assert.match(progress!.errorMessage ?? "", /503|R2/);
    } finally {
      await cleanup(fx);
      await closePool();
    }
  },
);
