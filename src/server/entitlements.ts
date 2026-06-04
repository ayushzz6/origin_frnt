/**
 * DB-backed entitlement source of truth — Phase 1.3.
 *
 * `entitledSubjects` is DERIVED at read time from active rows in
 * subscriptions.user_subscriptions; it is never a second stored column.
 * The legacy origin_users.is_premium / premium_expiry columns are kept as
 * denormalised mirrors recomputed on every webhook via
 * `recomputeUserPremiumFlags`.
 *
 * Pure, client-safe predicates (hasAnyPremium, canAccessSubject,
 * canAccessFeature, ...) live in `src/lib/entitlements.ts` and are re-exported
 * here so server code has a single import surface.
 *
 * See PREMIUM_AND_TEACHER_CONNECTION_PLAN.md (Phase 1.3).
 */

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { dbUpdateUser } from "@/server/db-users";
import type { StoredUser } from "@/legacy/store";
import { ensureSubscriptionsSchema } from "@/server/subscriptions/subscriptions-schema";
import { ALL_SUBJECTS, hasAnyPremium, isSubject, type Subject } from "@/lib/entitlements";

export * from "@/lib/entitlements";

function pool() {
  return getUserPostgresPool();
}

/**
 * SQL predicate (over a subscriptions.user_subscriptions row) for "currently
 * entitled". A subject is entitled while its billing period has not lapsed:
 *   - `active`            — the normal paid state.
 *   - `pending`/`halted`  — payment retry in progress; keep access to period end.
 *   - `cancelled`         — cancel_at_cycle_end; keep access to period end.
 * `created`/`authenticated` (never charged), `completed` and `expired` never
 * grant access. The reconciliation cron flips lapsed rows to `expired`.
 *
 * NOTE: this refines the literal `status='active'` query sketched in the plan
 * so that the grace-to-period-end behaviour (plan Risk #2) is actually honoured
 * while still recording the precise Razorpay status. See PLAN Phase 1.1/1.3.
 */
const ENTITLED_CLAUSE = `(
  (status = 'active' AND (current_period_end IS NULL OR current_period_end > NOW()))
  OR (status IN ('pending', 'halted', 'cancelled')
      AND current_period_end IS NOT NULL AND current_period_end > NOW())
)`;

/**
 * The subjects a user is currently entitled to: active subscriptions whose
 * billing period has not lapsed. Returns canonical-order, deduped subjects.
 * Falls back to `[]` when Postgres is not configured (local/dev without DB).
 */
export async function getEntitledSubjects(userId: string): Promise<Subject[]> {
  if (!userId || !isUserPostgresConfigured()) return [];
  // While the feature ships dark, keep this off the hot path entirely — no DB
  // round-trip on every user serialization and no premature schema creation.
  // Gating (Phase 1.4) keeps access open in that state regardless.
  if (!isFeatureEnabled("premiumSubscriptions")) return [];
  await ensureSubscriptionsSchema();
  const p = pool();
  if (!p) return [];
  const res = await p.query<{ subject: string }>(
    `SELECT DISTINCT subject
       FROM subscriptions.user_subscriptions
      WHERE user_id = $1 AND ${ENTITLED_CLAUSE}`,
    [userId],
  );
  const owned = new Set(res.rows.map((r) => r.subject).filter(isSubject));
  return ALL_SUBJECTS.filter((s) => owned.has(s));
}

/**
 * Enriches a serialized user payload with its derived `entitledSubjects`.
 * Used at every client-facing serialization exit (login/register/me/refresh
 * and the RSC seed) so `useAuth().user` and server gates agree.
 */
export async function withEntitledSubjects<T extends Record<string, unknown>>(
  payload: T,
  userId: string,
): Promise<T & { entitledSubjects: Subject[] }> {
  return { ...payload, entitledSubjects: await getEntitledSubjects(userId) };
}

/**
 * RSC page gate: should a free student be redirected to /premium? True only
 * when the feature is enabled, the caller is a student, and they own no
 * subject. Teachers/admins and the dark state are never redirected.
 */
export function shouldRedirectFreeStudent(
  user: { role?: string | null; entitledSubjects?: ReadonlyArray<string> | null } | null | undefined,
): boolean {
  if (!user || user.role !== "student") return false;
  if (!isFeatureEnabled("premiumSubscriptions")) return false;
  return !hasAnyPremium(user);
}

export type StudentGate = {
  /** True when premium gating actually applies (flag on AND the user is a student). */
  enforced: boolean;
  /** Subjects the student is entitled to (empty when free or not enforced). */
  subjects: Subject[];
  /** True when the student owns any subject — unlocks the global features. */
  anyPremium: boolean;
};

/**
 * Resolves how premium gating applies to a request. When the flag is off or the
 * caller is not a student, `enforced` is false and callers must leave access
 * fully open (today's behaviour). Otherwise it carries the entitled subjects so
 * server-side content filters can scope lists to what the student owns.
 */
export async function getStudentGate(
  userId: string,
  role: string | null | undefined,
): Promise<StudentGate> {
  if (role !== "student" || !isFeatureEnabled("premiumSubscriptions")) {
    return { enforced: false, subjects: [], anyPremium: true };
  }
  const subjects = await getEntitledSubjects(userId);
  return { enforced: true, subjects, anyPremium: subjects.length > 0 };
}

async function revalidateUserCache(userId: string): Promise<void> {
  // revalidateTag is only valid inside a Next request/render scope. The webhook
  // route runs in that scope; the reconciliation cron and integration tests do
  // not, so failures here are expected and safe to swallow.
  try {
    const { revalidateTag } = await import("next/cache");
    revalidateTag(`user:${userId}`, "max");
    revalidateTag("auth-user", "max");
  } catch {
    /* not in a request scope — nothing to revalidate */
  }
}

/**
 * Recomputes the denormalised origin_users.is_premium / premium_expiry mirrors
 * from the authoritative subscription rows, then revalidates the user/auth
 * caches so RSC + useAuth() pick up the new entitlement. Called after every
 * subscription state transition (webhook), and from the reconciliation cron.
 *
 * `is_premium` = active subject count > 0; `premium_expiry` = MAX period end.
 */
export async function recomputeUserPremiumFlags(userId: string): Promise<void> {
  if (!userId || !isUserPostgresConfigured()) return;
  await ensureSubscriptionsSchema();
  const p = pool();
  if (!p) return;
  const res = await p.query<{ subject_count: number; premium_expiry: Date | string | null }>(
    `SELECT COUNT(DISTINCT subject)::int AS subject_count,
            MAX(current_period_end)      AS premium_expiry
       FROM subscriptions.user_subscriptions
      WHERE user_id = $1 AND ${ENTITLED_CLAUSE}`,
    [userId],
  );
  const row = res.rows[0];
  const isPremium = (row?.subject_count ?? 0) > 0;
  const expiry = row?.premium_expiry ?? null;
  const premiumExpiry = expiry
    ? (expiry instanceof Date ? expiry.toISOString() : String(expiry))
    : null;

  await dbUpdateUser(userId, { isPremium, premiumExpiry } as Partial<StoredUser>);
  await revalidateUserCache(userId);
}
