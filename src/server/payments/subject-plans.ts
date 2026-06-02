/**
 * Maps each billable subject to its Razorpay monthly plan id (Phase 1.2).
 *
 * Plan ids are created once by scripts/seed-razorpay-plans.mjs and pasted into
 * the RAZORPAY_PLAN_* env vars; this module never creates plans in the request
 * path.
 *
 * See PREMIUM_AND_TEACHER_CONNECTION_PLAN.md (Phase 1.2).
 */

import { ALL_SUBJECTS, type Subject } from "@/lib/entitlements";

/** ₹499.00 in paise — the monthly price of one subject subscription. */
export const SUBJECT_PRICE_MINOR = 49900;

/**
 * Number of monthly billing cycles for a subject subscription. Razorpay
 * requires a finite total_count; 120 ≈ 10 years of "ongoing monthly", after
 * which the subscription naturally completes (and can be re-subscribed).
 */
export const SUBJECT_BILLING_CYCLES = 120;

const PLAN_ENV_BY_SUBJECT: Record<Subject, string> = {
  physics: "RAZORPAY_PLAN_PHYSICS",
  chemistry: "RAZORPAY_PLAN_CHEMISTRY",
  mathematics: "RAZORPAY_PLAN_MATHEMATICS",
  biology: "RAZORPAY_PLAN_BIOLOGY",
};

/** The env var name that holds a given subject's Razorpay plan id. */
export function planEnvVarFor(subject: Subject): string {
  return PLAN_ENV_BY_SUBJECT[subject];
}

/** Resolves a subject's Razorpay plan id, throwing if it is not configured. */
export function getSubjectPlanId(subject: Subject): string {
  const envVar = PLAN_ENV_BY_SUBJECT[subject];
  const planId = process.env[envVar]?.trim();
  if (!planId) {
    throw new Error(`${envVar} must be configured before subscribing to ${subject}.`);
  }
  return planId;
}

/** Returns the configured plan ids for all subjects (used by ops scripts). */
export function getConfiguredSubjectPlanIds(): Partial<Record<Subject, string>> {
  const out: Partial<Record<Subject, string>> = {};
  for (const subject of ALL_SUBJECTS) {
    const planId = process.env[PLAN_ENV_BY_SUBJECT[subject]]?.trim();
    if (planId) out[subject] = planId;
  }
  return out;
}
