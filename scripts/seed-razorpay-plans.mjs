#!/usr/bin/env node
/**
 * One-shot ops script: create the four monthly ₹499 per-subject Razorpay plans
 * and print the plan ids to paste into RAZORPAY_PLAN_* env vars.
 *
 * Usage (test or live keys depending on the env you load):
 *   node --env-file=.env.local scripts/seed-razorpay-plans.mjs
 *
 * This is NOT request-path code — plans are created once per Razorpay account
 * (test mode + live mode separately) and their ids pasted into env. See
 * PREMIUM_AND_TEACHER_CONNECTION_PLAN.md (Phase 1.2).
 */

import Razorpay from "razorpay";

const AMOUNT_MINOR = 49900; // ₹499.00

const SUBJECTS = [
  { env: "RAZORPAY_PLAN_PHYSICS", subject: "physics", name: "Origin Premium — Physics" },
  { env: "RAZORPAY_PLAN_CHEMISTRY", subject: "chemistry", name: "Origin Premium — Chemistry" },
  { env: "RAZORPAY_PLAN_MATHEMATICS", subject: "mathematics", name: "Origin Premium — Mathematics" },
  { env: "RAZORPAY_PLAN_BIOLOGY", subject: "biology", name: "Origin Premium — Biology" },
];

async function main() {
  const key_id = process.env.RAZORPAY_KEY_ID?.trim();
  const key_secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!key_id || !key_secret) {
    console.error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in the environment.");
    process.exit(1);
  }

  const client = new Razorpay({ key_id, key_secret });
  const created = {};

  for (const s of SUBJECTS) {
    const plan = await client.plans.create({
      period: "monthly",
      interval: 1,
      item: {
        name: s.name,
        amount: AMOUNT_MINOR,
        currency: "INR",
        description: `Monthly premium access to ${s.subject} on Origin.`,
      },
      notes: { origin_subject: s.subject },
    });
    created[s.env] = plan.id;
    console.log(`${s.subject.padEnd(12)} → ${plan.id}`);
  }

  console.log("\nPaste the following into your environment (test vs live keys are separate):");
  for (const [env, id] of Object.entries(created)) {
    console.log(`${env}=${id}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
