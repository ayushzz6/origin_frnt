/**
 * Phase 14 cutover backfill orchestration (data preservation).
 *
 * Inserts active `admin_comp` grants for all four subjects for every existing
 * premium user, then recomputes the is_premium / premium_expiry mirror over the
 * new derived (union) model so no current premium user — tohin1400@gmail.com
 * explicitly included — loses access. Idempotent: re-running inserts no new grants
 * and leaves the mirror unchanged.
 *
 * This module is the single place that bridges the subject-grants store and the
 * entitlement recompute (entitlements.ts imports the store, never the reverse, so
 * the backfill+recompute orchestration must sit one layer up to avoid a cycle).
 *
 * Invoked by scripts/backfill-phase14-premium-grants.mjs at migration time, and by
 * the phase14-premium-preservation integration test.
 */

import { recomputeUserPremiumFlags } from "@/server/entitlements";

import { backfillAdminCompGrants, listPremiumUserIds } from "./subject-grants-store";

export type PremiumGrantBackfillResult = {
  grantsInserted: number;
  usersRecomputed: number;
};

export async function runPremiumGrantBackfill(): Promise<PremiumGrantBackfillResult> {
  // 1. Insert the admin_comp grants (idempotent) BEFORE any recompute.
  const grantsInserted = await backfillAdminCompGrants();

  // 2. Recompute the mirror for every premium user so it reflects the union model.
  //    Done for all premium users (not just newly-granted ones) so a re-run also
  //    repairs any drift; recompute is itself idempotent.
  const userIds = await listPremiumUserIds();
  for (const userId of userIds) {
    await recomputeUserPremiumFlags(userId);
  }

  return { grantsInserted, usersRecomputed: userIds.length };
}
