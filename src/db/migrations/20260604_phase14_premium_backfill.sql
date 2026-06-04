-- Phase 14: cutover backfill (data preservation — must run AFTER
-- 20260604_phase14_subject_grants.sql and BEFORE any is_premium recompute).
--
-- Every existing premium user (origin_users.is_premium = TRUE) gets an active
-- `admin_comp` grant for all four subjects so that no current premium user loses
-- access under the new derived (union) entitlement model. tohin1400@gmail.com is
-- explicitly in scope. The insert is idempotent via the NOT EXISTS guard — re-running
-- never duplicates a grant (also enforced by uq_subject_grants_active_admin_comp).
--
-- The matching is_premium / premium_expiry recompute is NOT SQL: it runs in code
-- (recomputeUserPremiumFlags over the union) right after this insert. The canonical
-- runtime path is src/server/connect/premium-backfill.ts → runPremiumGrantBackfill(),
-- invoked by scripts/backfill-phase14-premium-grants.mjs at migration time.
-- See PREMIUM_AND_TEACHER_CONNECTION_PLAN.md (Phase 2 → Data preservation).

INSERT INTO entitlements.subject_grants
  (id, user_id, subject, source, status, expires_at, created_at)
SELECT 'grant_' || replace(gen_random_uuid()::text, '-', ''),
       u.id, s.subject, 'admin_comp', 'active', NULL, NOW()
FROM origin_users u
CROSS JOIN (VALUES ('physics'), ('chemistry'), ('mathematics'), ('biology')) AS s(subject)
WHERE u.is_premium = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM entitlements.subject_grants g
    WHERE g.user_id = u.id
      AND g.subject = s.subject
      AND g.source = 'admin_comp'
      AND g.status = 'active'
  );

INSERT INTO app.migrations (id, name)
VALUES ('20260604_phase14_premium_backfill', 'phase 14 cutover backfill admin_comp grants')
ON CONFLICT (id) DO NOTHING;
