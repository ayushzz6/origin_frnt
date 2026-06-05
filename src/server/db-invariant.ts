/**
 * Same-physical-DB invariant (AGENTS.md "Deployment guardrails", PLAN Phase-2
 * Risk #6).
 *
 * Several Phase-14 joins span the USER pool (USER_DATABASE_URL → app.* /
 * assessment.* / origin_users) and the OGCODE pool (OGCODE_DATABASE_URL →
 * analytics.* / rooms.*). They are correct ONLY when both pools point at the same
 * physical Neon database (the current production topology, which the cross-schema
 * FKs from rooms.rooms → app.teacher_workspaces / assessment.tests already
 * require). This module asserts that invariant at runtime so a misconfigured
 * split-DB deployment degrades safely (skips cohort analytics) instead of silently
 * reading an empty/foreign table.
 */

/** Resolve the OGCODE pool DSN exactly as src/server/postgres.ts does. */
function ogcodeDsn(): string | null {
  return (
    process.env.OGCODE_DATABASE_URL ??
    process.env.OGCODE_POSTGRES_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    null
  );
}

/** Resolve the USER pool DSN exactly as src/server/user-postgres.ts does. */
function userDsn(): string | null {
  return process.env.USER_DATABASE_URL ?? null;
}

/** host:port/database identity of a Postgres DSN, or null if unparseable. */
function physicalIdentity(dsn: string | null): string | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const host = url.hostname.toLowerCase();
    const port = url.port || "5432";
    const database = url.pathname.replace(/^\//, "").toLowerCase();
    return `${host}:${port}/${database}`;
  } catch {
    return null;
  }
}

/**
 * True when the USER and OGCODE pools resolve to the same physical database, so
 * cross-pool `analytics.* ⋈ app.* ⋈ assessment.*` reads are valid. When either DSN
 * is unset (e.g. local dev with only USER_DATABASE_URL) we conservatively return
 * true — the single configured pool serves every schema in that case.
 */
export function isSamePhysicalDatabase(): boolean {
  const user = physicalIdentity(userDsn());
  const ogcode = physicalIdentity(ogcodeDsn());
  if (!user || !ogcode) return true;
  return user === ogcode;
}

/**
 * Guard for cross-pool cohort analytics. Returns true when the join is safe to
 * run; otherwise logs once and returns false so callers skip the work instead of
 * throwing in a background job.
 */
export function assertCohortAnalyticsDbInvariant(): boolean {
  if (isSamePhysicalDatabase()) return true;
  console.warn(
    "[db-invariant] USER_DATABASE_URL and OGCODE_DATABASE_URL point at different " +
      "physical databases; skipping cross-schema cohort analytics (analytics.* ⋈ app.*).",
  );
  return false;
}
