/**
 * Phase 13 unit tests — pure entitlement predicates + Razorpay webhook
 * signature verification. No DB; safe to run anywhere.
 */

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  ALL_SUBJECTS,
  FREE_SAMPLE_POOL_SIZE,
  canAccessFeature,
  canAccessSubject,
  getEntitledSubjects,
  hasAnyPremium,
  normalizeSubject,
} from "../../src/lib/entitlements";
import { verifyRazorpayWebhookSignature } from "../../src/server/payments/razorpay-client";
import { getStudentGate, shouldRedirectFreeStudent } from "../../src/server/entitlements";

function withFlag(value: string | undefined, fn: () => void) {
  const before = process.env.TEACHER_LAUNCH_PREMIUM_SUBSCRIPTIONS;
  if (value === undefined) delete process.env.TEACHER_LAUNCH_PREMIUM_SUBSCRIPTIONS;
  else process.env.TEACHER_LAUNCH_PREMIUM_SUBSCRIPTIONS = value;
  try {
    fn();
  } finally {
    if (before === undefined) delete process.env.TEACHER_LAUNCH_PREMIUM_SUBSCRIPTIONS;
    else process.env.TEACHER_LAUNCH_PREMIUM_SUBSCRIPTIONS = before;
  }
}

const freeUser = { entitledSubjects: [] as string[] };
const physicsUser = { entitledSubjects: ["physics"] };
const multiUser = { entitledSubjects: ["physics", "maths"] }; // maths → mathematics

test("constants are stable", () => {
  assert.deepEqual(ALL_SUBJECTS, ["physics", "chemistry", "mathematics", "biology"]);
  assert.equal(FREE_SAMPLE_POOL_SIZE, 500);
});

test("normalizeSubject maps loose spellings", () => {
  assert.equal(normalizeSubject("maths"), "mathematics");
  assert.equal(normalizeSubject("Math"), "mathematics");
  assert.equal(normalizeSubject("PHYSICS"), "physics");
  assert.equal(normalizeSubject("bio"), "biology");
  assert.equal(normalizeSubject("mixed"), null);
  assert.equal(normalizeSubject(undefined), null);
});

test("getEntitledSubjects normalises, dedupes, and orders", () => {
  assert.deepEqual(getEntitledSubjects(multiUser), ["physics", "mathematics"]);
  assert.deepEqual(getEntitledSubjects(freeUser), []);
  assert.deepEqual(getEntitledSubjects(null), []);
});

test("free user has no premium access", () => {
  assert.equal(hasAnyPremium(freeUser), false);
  assert.equal(canAccessSubject(freeUser, "physics"), false);
  assert.equal(canAccessFeature(freeUser, "studyRooms"), false);
  assert.equal(canAccessFeature(freeUser, "tests", "physics"), false);
});

test("partial premium: global unlock vs subject-bound scoping", () => {
  assert.equal(hasAnyPremium(physicsUser), true);
  // Global-unlock features open the moment any subject is owned.
  assert.equal(canAccessFeature(physicsUser, "originAi"), true);
  assert.equal(canAccessFeature(physicsUser, "aiExplainer"), true);
  assert.equal(canAccessFeature(physicsUser, "studyRooms"), true);
  // Subject-bound features are scoped to the owned subject.
  assert.equal(canAccessSubject(physicsUser, "physics"), true);
  assert.equal(canAccessSubject(physicsUser, "chemistry"), false);
  assert.equal(canAccessFeature(physicsUser, "tests", "physics"), true);
  assert.equal(canAccessFeature(physicsUser, "tests", "chemistry"), false);
  // Without a subject, a subject-bound feature is reachable if any premium.
  assert.equal(canAccessFeature(physicsUser, "dpp"), true);
});

test("verifyRazorpayWebhookSignature accepts a valid HMAC and rejects tampering", () => {
  const before = process.env.RAZORPAY_WEBHOOK_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test_secret";
  try {
    const body = JSON.stringify({ event: "subscription.activated", payload: {} });
    const good = crypto.createHmac("sha256", "whsec_test_secret").update(body, "utf8").digest("hex");

    assert.equal(verifyRazorpayWebhookSignature(body, good), true);
    assert.equal(verifyRazorpayWebhookSignature(body, good.replace(/.$/, "0")), false);
    assert.equal(verifyRazorpayWebhookSignature(`${body} `, good), false);
    assert.equal(verifyRazorpayWebhookSignature(body, null), false);
    assert.equal(verifyRazorpayWebhookSignature(body, ""), false);
  } finally {
    if (before === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = before;
  }
});

test("shouldRedirectFreeStudent fires only for free students with the flag on", () => {
  withFlag("1", () => {
    assert.equal(shouldRedirectFreeStudent({ role: "student", entitledSubjects: [] }), true);
    assert.equal(shouldRedirectFreeStudent({ role: "student", entitledSubjects: ["physics"] }), false);
    assert.equal(shouldRedirectFreeStudent({ role: "teacher", entitledSubjects: [] }), false);
    assert.equal(shouldRedirectFreeStudent(null), false);
  });
  withFlag("0", () => {
    assert.equal(shouldRedirectFreeStudent({ role: "student", entitledSubjects: [] }), false);
  });
});

test("getStudentGate is unenforced when the flag is off or the caller is not a student", async () => {
  let gate = await new Promise<Awaited<ReturnType<typeof getStudentGate>>>((resolve) => {
    withFlag("0", () => void getStudentGate("u1", "student").then(resolve));
  });
  assert.equal(gate.enforced, false);
  assert.equal(gate.anyPremium, true);

  gate = await new Promise<Awaited<ReturnType<typeof getStudentGate>>>((resolve) => {
    withFlag("1", () => void getStudentGate("u1", "teacher").then(resolve));
  });
  assert.equal(gate.enforced, false);
});

test("verifyRazorpayWebhookSignature returns false when secret is unset", () => {
  const before = process.env.RAZORPAY_WEBHOOK_SECRET;
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  try {
    assert.equal(verifyRazorpayWebhookSignature("{}", "anything"), false);
  } finally {
    if (before !== undefined) process.env.RAZORPAY_WEBHOOK_SECRET = before;
  }
});
