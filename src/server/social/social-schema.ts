/**
 * Idempotent runtime ensure for the Student Social schema — @username handles +
 * profile-privacy columns on origin_users, a one-time handle backfill, the
 * case-insensitive unique index, pg_trgm search indexes, and social.follows
 * (one directed follow edge per row).
 *
 * Canonical SQL: src/db/migrations/20260623_student_social.sql
 * See STUDENT_SOCIAL_FOLLOW_PLAN.md.
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { ensureUserSchema } from "@/server/db-users";

declare global {
  var __originSocialSchemaEnsured: boolean | undefined;
  var __originSocialSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260623_student_social";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "student social — usernames, privacy, follow graph"],
  );
}

/**
 * Best-effort pg_trgm extension + trigram search indexes. Kept OUT of the main
 * transaction: on some managed Postgres roles CREATE EXTENSION is not permitted,
 * and search degrades gracefully to plain ILIKE without these indexes.
 */
async function ensureTrigramIndexes(): Promise<void> {
  try {
    await pool().query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
    await pool().query(
      "CREATE INDEX IF NOT EXISTS idx_origin_users_username_trgm ON origin_users USING gin (LOWER(username) gin_trgm_ops);",
    );
    await pool().query(
      "CREATE INDEX IF NOT EXISTS idx_origin_users_name_trgm ON origin_users USING gin (LOWER(name) gin_trgm_ops);",
    );
  } catch (error) {
    console.warn("[social-schema] pg_trgm search indexes unavailable; falling back to ILIKE:", error);
  }
}

export async function ensureSocialSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originSocialSchemaEnsured) return;
  if (!globalThis.__originSocialSchemaPromise) {
    globalThis.__originSocialSchemaPromise = (async () => {
      // origin_users must exist before the columns/FKs below can validate.
      await ensureUserSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");

        // 1. Identity + privacy columns.
        await client.query(`ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS username TEXT;`);
        await client.query(
          `ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS profile_private BOOLEAN NOT NULL DEFAULT FALSE;`,
        );

        // 2. Backfill a unique handle for users that lack one (slug + unique id suffix).
        await client.query(`
          UPDATE origin_users
          SET username = LEFT(LOWER(REGEXP_REPLACE(COALESCE(name, ''), '[^a-zA-Z0-9]+', '', 'g')), 15)
                         || '_' || split_part(id, '_', 2)
          WHERE username IS NULL
            AND LEFT(LOWER(REGEXP_REPLACE(COALESCE(name, ''), '[^a-zA-Z0-9]+', '', 'g')), 15) <> ''
            AND split_part(id, '_', 2) <> '';
        `);
        await client.query(`
          UPDATE origin_users
          SET username = 'user_' || LOWER(id)
          WHERE username IS NULL OR TRIM(username) = '';
        `);

        // 3. Case-insensitive uniqueness on the handle.
        await client.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS uq_origin_users_username_lower
            ON origin_users (LOWER(username));
        `);

        // 4. Follow graph.
        await client.query(`CREATE SCHEMA IF NOT EXISTS social;`);
        await client.query(`
          CREATE TABLE IF NOT EXISTS social.follows (
            follower_id  TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
            following_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (follower_id, following_id),
            CHECK (follower_id <> following_id)
          );

          CREATE INDEX IF NOT EXISTS idx_follows_following ON social.follows (following_id, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_follows_follower  ON social.follows (follower_id, created_at DESC);
        `);

        await recordMigration(client);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }

      // pg_trgm indexes are best-effort and live outside the essential transaction.
      await ensureTrigramIndexes();
      globalThis.__originSocialSchemaEnsured = true;
    })().catch((error) => {
      globalThis.__originSocialSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originSocialSchemaPromise;
}
