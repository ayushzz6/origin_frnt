/**
 * k6 load test — student join-by-code path.
 *
 * Phase 13 / V1/teacher-admin-launch-plan/05-implementation-roadmap.md
 *
 * Models the launch-day shape of an institute distributing a join code
 * to ~hundreds of students at once: every student hits POST
 * /api/enrollments/join-code with the same code at roughly the same
 * minute. The enrollment service deduplicates by (workspaceId, studentId),
 * so every retry should be idempotent — this script verifies under
 * load.
 *
 * NOT WIRED INTO CI. k6 isn't installed in the build image. Run it
 * locally against a staging deployment:
 *
 *   brew install k6   # one-time
 *   STUDENT_TOKEN=...  WORKSPACE_CODE=ABCDEF  BASE_URL=https://staging.o3origin.com \
 *     k6 run tests/load/code-join.k6.js
 *
 *   # Required env vars:
 *   #   BASE_URL          — frontend base URL (no trailing slash)
 *   #   WORKSPACE_CODE    — a real, active student-join code on the target env
 *   #   STUDENT_TOKEN     — access JWT cookie value for a student account
 *                            (open DevTools, copy `origin_access` cookie)
 *   #   STUDENT_CSRF      — `origin_csrf` cookie value for the same session
 *
 * The script ramps to 50 VUs, holds for 2 minutes, then ramps down.
 * Adjust to match the launch's expected concurrency.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const WORKSPACE_CODE = __ENV.WORKSPACE_CODE || "TESTCODE";
const STUDENT_TOKEN = __ENV.STUDENT_TOKEN || "";
const STUDENT_CSRF = __ENV.STUDENT_CSRF || "";

const joinDuration = new Trend("origin_join_duration_ms", true);
const joinSuccess = new Rate("origin_join_success");
const join429 = new Rate("origin_join_rate_limited");

export const options = {
  stages: [
    { duration: "30s", target: 10 },  // ramp-up
    { duration: "30s", target: 50 },  // peak ramp
    { duration: "2m",  target: 50 },  // hold launch shape
    { duration: "30s", target: 0 },   // cool-down
  ],
  thresholds: {
    "origin_join_success": ["rate>0.95"],
    "origin_join_duration_ms": ["p(95)<800"],
    // Rate limiter shouldn't fire before VU 50 unless something is wrong.
    "origin_join_rate_limited": ["rate<0.10"],
  },
};

export function setup() {
  if (!STUDENT_TOKEN || !STUDENT_CSRF) {
    throw new Error("Set STUDENT_TOKEN and STUDENT_CSRF env vars before running");
  }
  return { code: WORKSPACE_CODE };
}

export default function (data) {
  const url = `${BASE_URL}/api/enrollments/join-code`;
  const payload = JSON.stringify({ code: data.code });
  const params = {
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": STUDENT_CSRF,
      Cookie: `origin_access=${STUDENT_TOKEN}; origin_csrf=${STUDENT_CSRF}`,
    },
    tags: { endpoint: "join-code" },
  };

  const res = http.post(url, payload, params);
  joinDuration.add(res.timings.duration);
  joinSuccess.add(res.status === 200 || res.status === 201);
  join429.add(res.status === 429);

  check(res, {
    "status 200/201/429": (r) => r.status === 200 || r.status === 201 || r.status === 429,
    "no 5xx": (r) => r.status < 500,
  });

  // Pace per-VU so 50 VUs ≈ 50 req/s, not 50 × http-throughput.
  sleep(1);
}
