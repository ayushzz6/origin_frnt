/**
 * k6 load test — teacher batch analytics read path.
 *
 * Phase 13 / V1/teacher-admin-launch-plan/05-implementation-roadmap.md
 *
 * Models the post-test classroom shape: a teacher hits the batch radar
 * + leaderboard endpoints repeatedly while reviewing results, often
 * while a parallel cohort of teachers is doing the same on launch day.
 * The analytics service caches snapshots, so reads should stay sub-200ms
 * p95 under moderate concurrency. This script verifies that and flags
 * regressions before the launch.
 *
 * NOT WIRED INTO CI. k6 isn't installed in the build image. Run locally:
 *
 *   brew install k6
 *   TEACHER_TOKEN=...  TEACHER_CSRF=...  WORKSPACE_ID=...  BATCH_ID=... \
 *     BASE_URL=https://staging.o3origin.com \
 *     k6 run tests/load/batch-analytics.k6.js
 *
 *   # Required env vars:
 *   #   BASE_URL        — frontend base URL (no trailing slash)
 *   #   TEACHER_TOKEN   — access JWT cookie value for a teacher account
 *   #                     (open DevTools, copy `origin_access` cookie)
 *   #   TEACHER_CSRF    — `origin_csrf` cookie value for the same session
 *   #   WORKSPACE_ID    — workspace the teacher owns
 *   #   BATCH_ID        — a batch in that workspace with at least one
 *   #                     completed test attempt so analytics has data
 *
 * Ramps to 25 concurrent teachers (a reasonable peak for a single
 * institute in the post-test minute), holds 2 min, ramps down. Adjust
 * the stages to match the expected institute-class concurrency profile.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const WORKSPACE_ID = __ENV.WORKSPACE_ID || "";
const BATCH_ID = __ENV.BATCH_ID || "";
const TEACHER_TOKEN = __ENV.TEACHER_TOKEN || "";
const TEACHER_CSRF = __ENV.TEACHER_CSRF || "";

const radarDuration = new Trend("origin_radar_duration_ms", true);
const studentsDuration = new Trend("origin_students_duration_ms", true);
const analyticsSuccess = new Rate("origin_analytics_success");

export const options = {
  stages: [
    { duration: "30s", target: 5 },
    { duration: "30s", target: 25 },
    { duration: "2m",  target: 25 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    "origin_analytics_success": ["rate>0.98"],
    "origin_radar_duration_ms": ["p(95)<300"],
    "origin_students_duration_ms": ["p(95)<500"],
  },
};

export function setup() {
  if (!TEACHER_TOKEN || !TEACHER_CSRF || !WORKSPACE_ID || !BATCH_ID) {
    throw new Error("Set TEACHER_TOKEN, TEACHER_CSRF, WORKSPACE_ID, BATCH_ID env vars");
  }
  return { workspaceId: WORKSPACE_ID, batchId: BATCH_ID };
}

function authHeaders() {
  return {
    "x-csrf-token": TEACHER_CSRF,
    Cookie: `origin_access=${TEACHER_TOKEN}; origin_csrf=${TEACHER_CSRF}`,
  };
}

export default function (data) {
  // Teachers typically open the batch view, then drill into students.
  // Mirror that sequence so cache-hit/miss patterns look realistic.
  const radar = http.get(
    `${BASE_URL}/api/teacher/workspaces/${data.workspaceId}/analytics/batches/${data.batchId}`,
    { headers: authHeaders(), tags: { endpoint: "batch-radar" } },
  );
  radarDuration.add(radar.timings.duration);
  analyticsSuccess.add(radar.status === 200);
  check(radar, {
    "radar 200": (r) => r.status === 200,
    "no 5xx": (r) => r.status < 500,
  });

  sleep(0.5);

  const students = http.get(
    `${BASE_URL}/api/teacher/workspaces/${data.workspaceId}/students`,
    { headers: authHeaders(), tags: { endpoint: "students-list" } },
  );
  studentsDuration.add(students.timings.duration);
  analyticsSuccess.add(students.status === 200);
  check(students, {
    "students 200": (r) => r.status === 200,
    "no 5xx": (r) => r.status < 500,
  });

  sleep(2);
}
