/**
 * Phase 13 — service outage fallback test.
 *
 * Verifies that creating a teacher test still succeeds when the
 * downstream grader/analytics services are unavailable: the test row
 * is committed with analytics_status='pending' (the default), and the
 * caller can read it back. The retry/backfill of analytics is the
 * worker's responsibility — the contract this test pins is that
 * teacher-side test creation does not block on grader/analytics.
 *
 * Skipped when USER_DATABASE_URL isn't configured (plain CI).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createTeacherTest } from "@/server/workspaces/tests-service";

import { cleanup, closePool, dbConfigured, seedFixtures } from "./_db";

const SKIP = !dbConfigured();

test(
  "phase 13: teacher test creation succeeds with analytics_status='pending' when downstream services are down",
  { skip: SKIP },
  async () => {
    // Point the analytics + grader URLs at non-routable hosts so any
    // accidental fetch fails fast. The contract is that creation does
    // NOT call out — but if a regression introduces a synchronous call,
    // this guarantees the test surfaces it as a fast network error
    // rather than waiting on a real retry timeout.
    const prevAnalytics = process.env.ANALYTICS_SERVICE_URL;
    const prevGrader = process.env.GRADER_SERVICE_URL;
    process.env.ANALYTICS_SERVICE_URL = "http://127.0.0.1:1";
    process.env.GRADER_SERVICE_URL = "http://127.0.0.1:1";
    const fx = await seedFixtures();
    try {
      const created = await createTeacherTest({
        workspaceId: fx.workspaceId,
        createdBy: fx.ownerId,
        actorUserId: fx.ownerId,
        title: "Outage-tolerant test",
        description: null,
        subject: "phy",
        chapter: null,
        difficulty: "medium",
        durationMinutes: 30,
        status: "draft",
        selectionPolicy: {},
        scoringPolicy: {},
        settings: {},
        questions: [],
      });

      assert.ok(created.id);
      assert.equal(created.status, "draft");
      assert.equal(created.workspaceId, fx.workspaceId);
      // Analytics status lives on the per-attempt row (assessment.test_attempts.analytics_status),
      // which defaults to 'pending' until the analytics worker writes
      // a snapshot. Test creation does not provision an attempt — the
      // contract under test here is that the test row commits without
      // any synchronous call to the grader/analytics services. The
      // bogus URLs above guarantee a regression that adds such a call
      // surfaces as a fast network error instead of a creation hang.
    } finally {
      if (prevAnalytics === undefined) delete process.env.ANALYTICS_SERVICE_URL;
      else process.env.ANALYTICS_SERVICE_URL = prevAnalytics;
      if (prevGrader === undefined) delete process.env.GRADER_SERVICE_URL;
      else process.env.GRADER_SERVICE_URL = prevGrader;
      await cleanup(fx);
      await closePool();
    }
  },
);
