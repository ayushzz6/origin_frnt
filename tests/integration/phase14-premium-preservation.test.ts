/**
 * Phase 14 — cutover backfill / premium preservation (data preservation).
 *
 * Asserts that an existing premium user (tohin1400@gmail.com is explicitly in
 * scope) keeps entitledSubjects = all four AND is_premium = true under the new
 * derived (union) model after the backfill, and that the backfill is idempotent.
 *
 * Runs only when USER_DATABASE_URL is configured (CI + opt-in local).
 */

import test from "node:test";
import assert from "node:assert/strict";

// Both the read path (getEntitledSubjects) and the union depend on a flag.
process.env.TEACHER_LAUNCH_TEACHER_CONNECT = "1";

import { ensureUserSchema, dbFindUserById } from "@/server/db-users";
import { getEntitledSubjects } from "@/server/entitlements";
import { ensureSubjectGrantsSchema } from "@/server/connect/subject-grants-schema";
import { runPremiumGrantBackfill } from "@/server/connect/premium-backfill";

import { closePool, dbConfigured, makeId, rawPool } from "./_db";

const SKIP = !dbConfigured();
const it = test;

const PRESERVED_EMAIL = "tohin1400@gmail.com";

async function countAdminCompGrants(userId: string): Promise<number> {
  const res = await rawPool().query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM entitlements.subject_grants
      WHERE user_id = $1 AND source = 'admin_comp' AND status = 'active'`,
    [userId],
  );
  return Number(res.rows[0]?.count ?? "0");
}

async function cleanup(userId: string): Promise<void> {
  const pool = rawPool();
  await pool.query(`DELETE FROM entitlements.subject_grants WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM origin_users WHERE id = $1`, [userId]);
}

it("phase 14: existing premium user keeps all-4 entitlement + is_premium after backfill", { skip: SKIP }, async () => {
  await ensureUserSchema();
  await ensureSubjectGrantsSchema();
  const userId = makeId("user_tohin");
  // Remove any stale row for the in-scope email first (CI db is ephemeral).
  await rawPool().query(`DELETE FROM origin_users WHERE email = $1`, [PRESERVED_EMAIL]);
  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, role, is_premium, password_hash)
     VALUES ($1, 'Preserved Premium', $2, 'student', TRUE, 'test-no-login')`,
    [userId, PRESERVED_EMAIL],
  );

  try {
    const first = await runPremiumGrantBackfill();
    assert.ok(first.grantsInserted >= 4, "inserts four admin_comp grants for the premium user");

    const entitled = await getEntitledSubjects(userId);
    assert.deepEqual(entitled, ["physics", "chemistry", "mathematics", "biology"]);

    const user = await dbFindUserById(userId);
    assert.equal(user?.isPremium, true, "is_premium mirror stays true post-backfill");

    assert.equal(await countAdminCompGrants(userId), 4);

    // Idempotent: a second run inserts nothing and leaves exactly four grants.
    const second = await runPremiumGrantBackfill();
    assert.equal(await countAdminCompGrants(userId), 4, "backfill is idempotent");
    assert.equal(
      second.grantsInserted,
      0,
      "second backfill inserts no new grants for the already-preserved user",
    );

    const stillEntitled = await getEntitledSubjects(userId);
    assert.deepEqual(stillEntitled, ["physics", "chemistry", "mathematics", "biology"]);
  } finally {
    await cleanup(userId);
  }
});

test.after(async () => {
  if (!SKIP) await closePool();
});
