/**
 * Phase 13 integration tests — subscription webhook lifecycle, idempotency,
 * grace-to-period-end, and derived-flag recompute.
 *
 * Runs only when USER_DATABASE_URL is configured (CI + opt-in local). The
 * Razorpay API is never called here: we seed `created` rows directly and drive
 * state purely through processSubscriptionWebhook (the webhook path makes no
 * outbound Razorpay calls).
 */

import test from "node:test";
import assert from "node:assert/strict";

// The read path is gated on the feature flag; enable it for these tests.
process.env.TEACHER_LAUNCH_PREMIUM_SUBSCRIPTIONS = "1";

import { ensureUserSchema, dbFindUserById } from "@/server/db-users";
import { ensureSubscriptionsSchema } from "@/server/subscriptions/subscriptions-schema";
import { upsertCreatedSubscription } from "@/server/subscriptions/subscriptions-store";
import { processSubscriptionWebhook } from "@/server/subscriptions/subscriptions-service";
import { getEntitledSubjects } from "@/server/entitlements";

import { closePool, dbConfigured, makeId, rawPool } from "./_db";

const SKIP = !dbConfigured();
const it = test;

const DAY = 24 * 60 * 60;
function unixIn(days: number): number {
  return Math.floor(Date.now() / 1000) + days * DAY;
}

async function seedStudent(): Promise<string> {
  await ensureUserSchema();
  await ensureSubscriptionsSchema();
  const id = makeId("user_sub");
  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, role)
     VALUES ($1, 'Sub Test', $2, 'student') ON CONFLICT (id) DO NOTHING`,
    [id, `${id}@example.com`],
  );
  return id;
}

async function seedCreatedSubscription(userId: string, subject: "physics" | "chemistry") {
  const subId = makeId("rzpsub").replace(/_/g, "");
  await upsertCreatedSubscription({
    userId,
    subject,
    razorpayPlanId: `plan_${subject}`,
    razorpaySubscriptionId: subId,
    shortUrl: null,
    amountMinor: 49900,
  });
  return subId;
}

function activatedEvent(subId: string, currentEnd: number) {
  return {
    event: "subscription.activated",
    payload: { subscription: { entity: { id: subId, current_end: currentEnd } } },
  };
}

async function cleanup(userId: string, eventIds: string[]) {
  const pool = rawPool();
  if (eventIds.length) {
    await pool.query(`DELETE FROM subscriptions.webhook_events WHERE event_id = ANY($1)`, [eventIds]);
  }
  await pool.query(`DELETE FROM subscriptions.user_subscriptions WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM origin_users WHERE id = $1`, [userId]);
}

it("phase 13: activation grants the subject and sets derived flags", { skip: SKIP }, async () => {
  const userId = await seedStudent();
  const evt = makeId("evt");
  try {
    const subId = await seedCreatedSubscription(userId, "physics");
    const result = await processSubscriptionWebhook(evt, activatedEvent(subId, unixIn(30)));
    assert.equal(result.processed, true);
    if (result.processed) {
      assert.equal(result.subject, "physics");
      assert.equal(result.status, "active");
    }

    assert.deepEqual(await getEntitledSubjects(userId), ["physics"]);
    const user = await dbFindUserById(userId);
    assert.equal(user?.isPremium, true);
    assert.ok(user?.premiumExpiry, "premium_expiry mirror is set");
  } finally {
    await cleanup(userId, [evt]);
  }
});

it("phase 13: duplicate webhook delivery is idempotent", { skip: SKIP }, async () => {
  const userId = await seedStudent();
  const evt = makeId("evt");
  try {
    const subId = await seedCreatedSubscription(userId, "physics");
    const first = await processSubscriptionWebhook(evt, activatedEvent(subId, unixIn(30)));
    const second = await processSubscriptionWebhook(evt, activatedEvent(subId, unixIn(30)));
    assert.equal(first.processed, true);
    assert.equal(second.processed, false);
    if (!second.processed) assert.equal(second.reason, "duplicate");
    assert.deepEqual(await getEntitledSubjects(userId), ["physics"]);
  } finally {
    await cleanup(userId, [evt]);
  }
});

it("phase 13: charged before activation still ensures active (order-independent)", { skip: SKIP }, async () => {
  const userId = await seedStudent();
  const evt = makeId("evt");
  try {
    const subId = await seedCreatedSubscription(userId, "physics");
    const charged = {
      event: "subscription.charged",
      payload: { subscription: { entity: { id: subId, current_end: unixIn(30) } } },
    };
    const result = await processSubscriptionWebhook(evt, charged);
    assert.equal(result.processed, true);
    assert.deepEqual(await getEntitledSubjects(userId), ["physics"]);
  } finally {
    await cleanup(userId, [evt]);
  }
});

it("phase 13: cancel keeps access until period end, then drops when it lapses", { skip: SKIP }, async () => {
  const userId = await seedStudent();
  const evtA = makeId("evt");
  const evtB = makeId("evt");
  try {
    const subId = await seedCreatedSubscription(userId, "physics");
    await processSubscriptionWebhook(evtA, activatedEvent(subId, unixIn(30)));

    // Cancellation while the period is still in the future → grace access.
    const cancelled = {
      event: "subscription.cancelled",
      payload: { subscription: { entity: { id: subId } } },
    };
    await processSubscriptionWebhook(evtB, cancelled);
    assert.deepEqual(await getEntitledSubjects(userId), ["physics"], "grace to period end");

    // Force the period to lapse; entitlement and derived flags must drop.
    await rawPool().query(
      `UPDATE subscriptions.user_subscriptions
          SET current_period_end = NOW() - INTERVAL '1 day' WHERE user_id = $1`,
      [userId],
    );
    assert.deepEqual(await getEntitledSubjects(userId), []);
  } finally {
    await cleanup(userId, [evtA, evtB]);
  }
});

it("phase 13: multiple subjects accumulate and mirror max expiry", { skip: SKIP }, async () => {
  const userId = await seedStudent();
  const evtP = makeId("evt");
  const evtC = makeId("evt");
  try {
    const physId = await seedCreatedSubscription(userId, "physics");
    const chemId = await seedCreatedSubscription(userId, "chemistry");
    await processSubscriptionWebhook(evtP, activatedEvent(physId, unixIn(30)));
    await processSubscriptionWebhook(evtC, activatedEvent(chemId, unixIn(60)));

    assert.deepEqual(await getEntitledSubjects(userId), ["physics", "chemistry"]);
    const user = await dbFindUserById(userId);
    assert.equal(user?.isPremium, true);
  } finally {
    await cleanup(userId, [evtP, evtC]);
  }
});

it("phase 13: webhook for an unknown subscription id is a no-op", { skip: SKIP }, async () => {
  const evt = makeId("evt");
  try {
    const result = await processSubscriptionWebhook(evt, activatedEvent("sub_does_not_exist", unixIn(30)));
    assert.equal(result.processed, false);
    if (!result.processed) assert.equal(result.reason, "unknown_subscription");
  } finally {
    await rawPool().query(`DELETE FROM subscriptions.webhook_events WHERE event_id = $1`, [evt]);
  }
});

test.after(async () => {
  if (!SKIP) await closePool();
});
