/**
 * Tests for the phase 10-12 review-gap fixes — the bugs Qwen's pass left
 * behind that we patched up. Each test corresponds to a specific gap
 * described in V1/teacher-admin-launch-plan/05-implementation-roadmap.md
 * (phases 10–12).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getApiRoutePolicy } from "@/server/route-policy";

const MIGRATIONS_DIR = join(__dirname, "../../src/db/migrations");

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), "utf8");
}

// ── Phase 10 ────────────────────────────────────────────────────────────────

test("phase 10 canonical SQL uses plan-canonical import_job_status labels", () => {
  const sql = readMigration("20260521_phase10_document_import.sql");
  // Plan values (02-database-schema-design.md): queued, processing,
  // needs_review, succeeded, failed, cancelled. Earlier Qwen draft had
  // 'review_required' + 'completed' which the runtime ensure never
  // writes — that drift caused every status update to fail with an
  // enum-mismatch error on production DBs that applied the SQL first.
  assert.match(sql, /'queued', 'processing', 'needs_review', 'succeeded', 'failed', 'cancelled'/);
  assert.doesNotMatch(sql, /'review_required'.*'completed'/);
});

test("phase 10 canonical SQL no longer creates dead phase-12 app.* tables", () => {
  const sql = readMigration("20260521_phase10_document_import.sql");
  // Dead code carried over from Qwen's first pass — superseded by
  // commerce.workspace_offerings + commerce.enrollment_orders in
  // 20260521_phase12_paid_enrollment.sql. The marketplace store
  // writes to commerce.* exclusively.
  assert.doesNotMatch(sql, /CREATE TABLE[^;]*app\.workspace_offerings/);
  assert.doesNotMatch(sql, /CREATE TABLE[^;]*app\.enrollment_orders/);
});

test("phase 10 follow-up migration renames mis-labeled enum values + drops dead tables", () => {
  const sql = readMigration("20260523_phase10_fix_status_enum.sql");
  assert.match(sql, /RENAME VALUE ''review_required'' TO ''needs_review''/);
  assert.match(sql, /RENAME VALUE ''completed'' TO ''succeeded''/);
  assert.match(sql, /DROP TABLE IF EXISTS app\.workspace_offerings/);
  assert.match(sql, /DROP TABLE IF EXISTS app\.enrollment_orders/);
});

// ── Phase 11 ────────────────────────────────────────────────────────────────

test("phase 11 admin routes are wired into the route-policy table", () => {
  // Every admin route the plan calls for must be recognized by the
  // middleware as authenticated. If a route file is missing entirely,
  // its policy is "unconfigured" and the middleware refuses to
  // protect it.
  const routes = [
    "/api/admin/workspaces",
    "/api/admin/workspaces/ws_123",
    "/api/admin/workspaces/ws_123/codes/wcode_123/revoke",
    "/api/admin/import-jobs",
    "/api/admin/import-jobs/dijob_123",
    "/api/admin/ogcode/moderation",
    "/api/admin/ogcode/moderation/ogpub_123/approve",
    "/api/admin/ogcode/moderation/ogpub_123/reject",
  ];
  for (const route of routes) {
    assert.equal(getApiRoutePolicy(route).kind, "authenticated", `route ${route} missing`);
  }
});

// ── Phase 12 ────────────────────────────────────────────────────────────────

test("phase 12 orders route gates webhook actions behind PAYMENT_WEBHOOK_TOKEN", () => {
  const route = readFileSync(
    join(__dirname, "../../src/app/api/enrollments/orders/route.ts"),
    "utf8",
  );
  // Webhook-only actions must require an internal service token, not
  // student session auth. Otherwise a logged-in student could mark
  // their own order as paid and trigger free enrollment.
  assert.match(route, /WEBHOOK_ACTIONS\s*=\s*new Set\(\["mark_payment_pending",\s*"mark_paid",\s*"mark_failed"\]\)/);
  assert.match(route, /requireInternal\(request,\s*"PAYMENT_WEBHOOK_TOKEN"\)/);
});

test("phase 12 marketplace assigns paid students with assignedBy=null (FK-safe)", () => {
  const service = readFileSync(
    join(__dirname, "../../src/server/workspaces/marketplace-service.ts"),
    "utf8",
  );
  // batch_members.assigned_by is FK to origin_users(id); passing a
  // sentinel string like "system" violates the constraint and crashes
  // every paid order with a target batch.
  assert.match(service, /assignedBy:\s*null/);
  assert.doesNotMatch(service, /assignedBy:\s*"system"/);
});

test("phase 12 createOrderService reuses non-terminal/paid orders (idempotency)", () => {
  const service = readFileSync(
    join(__dirname, "../../src/server/workspaces/marketplace-service.ts"),
    "utf8",
  );
  // Plan acceptance criterion: "duplicate purchase handled
  // idempotently". A second buy click on the same offering must
  // return the existing order, not create a parallel one.
  assert.match(service, /findReusableOrderForStudent/);
  assert.match(service, /status === "paid"/);
  assert.match(service, /status === "created"/);
  assert.match(service, /status === "payment_pending"/);
});

test("PAYMENT_WEBHOOK_TOKEN is registered in the service-auth token set", () => {
  const file = readFileSync(
    join(__dirname, "../../src/server/service-auth.ts"),
    "utf8",
  );
  assert.match(file, /"PAYMENT_WEBHOOK_TOKEN"/);
});
