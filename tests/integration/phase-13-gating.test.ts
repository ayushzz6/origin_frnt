/**
 * Phase 13 integration tests — entitlement gate resolution that drives every
 * server-side content filter (tests, DPP, OG Code). Runs only when
 * USER_DATABASE_URL is configured (CI + opt-in local).
 *
 * The per-item filter decisions (subjectVisibleUnderGate, free 500-pool clamp)
 * are covered by the pure predicates in tests/unit/entitlements.test.ts; here we
 * verify the DB-backed gate flips correctly between free and premium.
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.TEACHER_LAUNCH_PREMIUM_SUBSCRIPTIONS = "1";

import { ensureUserSchema } from "@/server/db-users";
import { ensureSubscriptionsSchema } from "@/server/subscriptions/subscriptions-schema";
import { upsertCreatedSubscription } from "@/server/subscriptions/subscriptions-store";
import { processSubscriptionWebhook } from "@/server/subscriptions/subscriptions-service";
import { getStudentGate } from "@/server/entitlements";

import { closePool, dbConfigured, makeId, rawPool } from "./_db";

const SKIP = !dbConfigured();
const it = test;

async function seedStudent(): Promise<string> {
  await ensureUserSchema();
  await ensureSubscriptionsSchema();
  const id = makeId("user_gate");
  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, role)
     VALUES ($1, 'Gate Test', $2, 'student') ON CONFLICT (id) DO NOTHING`,
    [id, `${id}@example.com`],
  );
  return id;
}

async function cleanup(userId: string, eventIds: string[]) {
  const pool = rawPool();
  if (eventIds.length) {
    await pool.query(`DELETE FROM subscriptions.webhook_events WHERE event_id = ANY($1)`, [eventIds]);
  }
  await pool.query(`DELETE FROM subscriptions.user_subscriptions WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM origin_users WHERE id = $1`, [userId]);
}

it("phase 13 gating: a free student is enforced with no entitled subjects", { skip: SKIP }, async () => {
  const userId = await seedStudent();
  try {
    const gate = await getStudentGate(userId, "student");
    assert.equal(gate.enforced, true);
    assert.equal(gate.anyPremium, false);
    assert.deepEqual(gate.subjects, []);
  } finally {
    await cleanup(userId, []);
  }
});

it("phase 13 gating: a premium student is scoped to their entitled subjects", { skip: SKIP }, async () => {
  const userId = await seedStudent();
  const evt = makeId("evt");
  try {
    const subId = makeId("rzpsub").replace(/_/g, "");
    await upsertCreatedSubscription({
      userId,
      subject: "physics",
      razorpayPlanId: "plan_physics",
      razorpaySubscriptionId: subId,
      shortUrl: null,
      amountMinor: 49900,
    });
    await processSubscriptionWebhook(evt, {
      event: "subscription.activated",
      payload: {
        subscription: { entity: { id: subId, current_end: Math.floor(Date.now() / 1000) + 30 * 86400 } },
      },
    });

    const gate = await getStudentGate(userId, "student");
    assert.equal(gate.enforced, true);
    assert.equal(gate.anyPremium, true);
    assert.deepEqual(gate.subjects, ["physics"]);
  } finally {
    await cleanup(userId, [evt]);
  }
});

test.after(async () => {
  if (!SKIP) await closePool();
});
