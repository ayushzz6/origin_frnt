/**
 * Phase 14 cutover backfill — run ONCE at migration time, after the phase-14
 * schema migrations are applied.
 *
 * Inserts active `admin_comp` subject grants for all four subjects for every
 * existing premium user (idempotent), then recomputes the is_premium /
 * premium_expiry mirror over the new union model so no current premium user —
 * tohin1400@gmail.com included — loses access.
 *
 * Usage (secrets only at migration time, never committed):
 *   cd new-frontend
 *   npx tsx --env-file=/Users/xyx/Projects/Origin/.env \
 *     scripts/backfill-phase14-premium-grants.ts
 *
 * Re-running is safe: no new grants are inserted and the mirror is unchanged.
 */

import { runPremiumGrantBackfill } from "@/server/connect/premium-backfill";

async function main() {
  if (!process.env.USER_DATABASE_URL) {
    console.error("USER_DATABASE_URL is not set — load the prod env file before running.");
    process.exit(1);
  }
  const result = await runPremiumGrantBackfill();
  console.log(
    `[phase14 backfill] inserted ${result.grantsInserted} admin_comp grant(s); ` +
      `recomputed mirrors for ${result.usersRecomputed} premium user(s).`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("[phase14 backfill] failed", error);
  process.exit(1);
});
