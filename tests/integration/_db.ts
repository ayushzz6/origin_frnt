/**
 * Shared helpers for DB-backed integration tests.
 *
 * Skips the test when USER_DATABASE_URL is not configured so this file
 * is safe to run on a dev box without Postgres up. CI sets the env to
 * the docker-compose Postgres at scripts/start-test-postgres.sh.
 *
 * Each test that opts in calls `seedFixtures()` to provision a fresh
 * workspace + student + offering, and `cleanup()` after to delete them
 * so consecutive runs don't accumulate rows.
 */

import { Pool } from "pg";

import { createWorkspaceWithOwner, upsertMember } from "@/server/workspaces/store";
import { ensureWorkspaceSchema } from "@/server/workspaces/schema";
import { ensureEnrollmentSchema } from "@/server/workspaces/enrollment-schema";
import { ensureCommerceSchema } from "@/server/workspaces/commerce-schema";
import { createBatch } from "@/server/workspaces/batches";
import { createOffering as storeCreateOffering } from "@/server/workspaces/marketplace-store";

export function dbConfigured(): boolean {
  return Boolean(process.env.USER_DATABASE_URL);
}

export function makeId(prefix: string): string {
  return `${prefix}_test_${Math.random().toString(36).slice(2, 12)}`;
}

let _pool: Pool | null = null;
export function rawPool(): Pool {
  if (_pool) return _pool;
  const url = process.env.USER_DATABASE_URL;
  if (!url) throw new Error("USER_DATABASE_URL not set");
  _pool = new Pool({ connectionString: url, max: 3 });
  return _pool;
}

export async function ensureCoreSchemas(): Promise<void> {
  await ensureWorkspaceSchema();
  await ensureEnrollmentSchema();
  await ensureCommerceSchema();
}

export type Fixtures = {
  ownerId: string;
  studentId: string;
  workspaceId: string;
  batchId: string;
  offeringId: string;
};

export async function seedFixtures(): Promise<Fixtures> {
  await ensureCoreSchemas();
  const pool = rawPool();

  const ownerId = makeId("user_owner");
  const studentId = makeId("user_student");

  // origin_users rows must exist before workspaces / enrollments insert.
  // password_hash is NOT NULL (db-users.ts) — seed a placeholder (these fixtures
  // never authenticate via password) so the insert satisfies the constraint on a
  // fresh database.
  await pool.query(
    `INSERT INTO origin_users (id, name, email, role, password_hash) VALUES
       ($1, 'Test Owner', $2, 'teacher', 'test-no-login'),
       ($3, 'Test Student', $4, 'student', 'test-no-login')
     ON CONFLICT (id) DO NOTHING`,
    [ownerId, `${ownerId}@example.com`, studentId, `${studentId}@example.com`],
  );

  const ws = await createWorkspaceWithOwner({
    workspaceType: "institute",
    ownerUserId: ownerId,
    displayName: "Test Institute",
    legalName: null,
    slug: makeId("slug").replace(/_/g, "-"),
    city: "Test City",
    state: null,
    country: "IN",
    subjects: ["Physics"],
    courses: [],
  });

  await upsertMember({
    workspaceId: ws.id,
    userId: ownerId,
    role: "owner",
    status: "active",
  });

  const batch = await createBatch({
    workspaceId: ws.id,
    name: "Test Batch",
    createdBy: ownerId,
  });

  const offering = await storeCreateOffering({
    workspaceId: ws.id,
    title: "Test Offering",
    priceMinor: 99900,
    currency: "INR",
    targetBatchId: batch.id,
    status: "active",
  });

  return {
    ownerId,
    studentId,
    workspaceId: ws.id,
    batchId: batch.id,
    offeringId: offering.id,
  };
}

export async function cleanup(fx: Fixtures): Promise<void> {
  const pool = rawPool();
  // Delete cascades from app.teacher_workspaces handle most of it.
  await pool.query(`DELETE FROM commerce.enrollment_orders WHERE workspace_id = $1`, [
    fx.workspaceId,
  ]);
  await pool.query(`DELETE FROM commerce.workspace_offerings WHERE workspace_id = $1`, [
    fx.workspaceId,
  ]);
  await pool.query(`DELETE FROM app.teacher_workspaces WHERE id = $1`, [fx.workspaceId]);
  await pool.query(`DELETE FROM origin_users WHERE id IN ($1, $2)`, [
    fx.ownerId,
    fx.studentId,
  ]);
}

export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
