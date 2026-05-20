/**
 * Postgres-backed implementations of user, auth session, and task operations.
 * All functions return null / throw when Postgres is not configured — callers
 * must check isUserPostgresConfigured() and fall back to the Postgres-backed store.
 *
 * Schema: see src/db/schema.sql
 * Activate by setting USER_DATABASE_URL in your environment.
 */

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Pool } from "pg";
import { withStoredUserDefaults, type StoredAuthSession, type StoredTask, type StoredUser, type StoredUserWithOptionalDefaults } from "@/server/store";
import { getUserPostgresPool } from "@/server/user-postgres";
import {
  createRefreshToken,
  createSessionId,
  hashRefreshTokenSecret,
  issueAccessTokenForUser,
  parseRefreshToken,
} from "@/server/auth-jwt";
import type { UserImagePurpose } from "@/server/media-storage";

export const REFRESH_TOKEN_ROTATION_INTERVAL_MS = 24 * 60 * 60 * 1000;
// Keep the immediately previous refresh hash valid for the session lifetime.
// Browser tabs can complete refresh responses out of order; accepting the last
// hash prevents a stale Set-Cookie from logging the user out minutes later.
const REFRESH_REPLAY_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldRotateRefreshToken(
  lastRotatedAt: Date | string | null | undefined,
  createdAt: Date | string | null | undefined,
  nowMs = Date.now(),
  isGraceReplay = false,
): boolean {
  if (isGraceReplay) return false;
  const reference = lastRotatedAt ?? createdAt;
  const referenceMs = reference ? new Date(reference).getTime() : 0;
  return !Number.isFinite(referenceMs) || nowMs - referenceMs >= REFRESH_TOKEN_ROTATION_INTERVAL_MS;
}

declare global {
  var __originUserSchemaEnsured: boolean | undefined;
  var __originUserSchemaPromise: Promise<void> | undefined;
}

function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export async function ensureUserSchema(): Promise<void> {
  if (globalThis.__originUserSchemaEnsured) return;
  if (!globalThis.__originUserSchemaPromise) {
    globalThis.__originUserSchemaPromise = (async () => {
      const client = await pool().connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS origin_users (
            id                  TEXT PRIMARY KEY,
            name                TEXT NOT NULL,
            email               TEXT NOT NULL,
            password_hash       TEXT NOT NULL,
            role                TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
            student_class       TEXT,
            field_of_interest   TEXT,
            referral_source     TEXT,
            avatar              TEXT,
            streak              INTEGER NOT NULL DEFAULT 0,
            total_study_time    INTEGER NOT NULL DEFAULT 0,
            joined_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            is_premium          BOOLEAN NOT NULL DEFAULT FALSE,
            premium_expiry      TIMESTAMPTZ,
            is_onboarded        BOOLEAN NOT NULL DEFAULT FALSE,
            selected_course     TEXT,
            is_dropper          BOOLEAN NOT NULL DEFAULT FALSE,
            years_of_experience TEXT,
            subjects            TEXT[] NOT NULL DEFAULT '{}',
            student_capacity    TEXT,
            location            TEXT,
            voice_minutes_used_today FLOAT NOT NULL DEFAULT 0,
            tokens_used_today   INTEGER NOT NULL DEFAULT 0,
            usage_reset_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            auth_token_version  INTEGER NOT NULL DEFAULT 0,
            UNIQUE (email, role)
          );

          -- Migrations
          ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS location TEXT;
          ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS voice_minutes_used_today FLOAT NOT NULL DEFAULT 0;
          ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS tokens_used_today INTEGER NOT NULL DEFAULT 0;
          ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS usage_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
          ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS auth_token_version INTEGER NOT NULL DEFAULT 0;

          CREATE TABLE IF NOT EXISTS origin_auth_sessions (
            id                        TEXT PRIMARY KEY,
            access_token              TEXT,
            access_fingerprint        TEXT,
            refresh_token             TEXT,
            refresh_token_hash        TEXT UNIQUE,
            previous_refresh_token_hash TEXT,
            refresh_rotated_at        TIMESTAMPTZ,
            user_id                   TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
            created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            access_token_expires_at   TIMESTAMPTZ NOT NULL,
            refresh_token_expires_at  TIMESTAMPTZ NOT NULL,
            revoked_at                TIMESTAMPTZ,
            last_used_at              TIMESTAMPTZ,
            user_agent_hash           TEXT,
            ip_prefix_hash            TEXT
          );

          ALTER TABLE origin_auth_sessions ADD COLUMN IF NOT EXISTS id TEXT;
          ALTER TABLE origin_auth_sessions ADD COLUMN IF NOT EXISTS access_fingerprint TEXT;
          ALTER TABLE origin_auth_sessions ADD COLUMN IF NOT EXISTS refresh_token_hash TEXT;
          ALTER TABLE origin_auth_sessions ADD COLUMN IF NOT EXISTS previous_refresh_token_hash TEXT;
          ALTER TABLE origin_auth_sessions ADD COLUMN IF NOT EXISTS refresh_rotated_at TIMESTAMPTZ;
          ALTER TABLE origin_auth_sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
          ALTER TABLE origin_auth_sessions ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
          ALTER TABLE origin_auth_sessions ADD COLUMN IF NOT EXISTS user_agent_hash TEXT;
          ALTER TABLE origin_auth_sessions ADD COLUMN IF NOT EXISTS ip_prefix_hash TEXT;
          UPDATE origin_auth_sessions SET id = COALESCE(id, access_token, refresh_token)
          WHERE id IS NULL;
          ALTER TABLE origin_auth_sessions ALTER COLUMN id SET NOT NULL;

          DO $$
          DECLARE
            pk_name TEXT;
            pk_column TEXT;
          BEGIN
            SELECT c.conname, a.attname INTO pk_name, pk_column
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            JOIN unnest(c.conkey) WITH ORDINALITY AS keys(attnum, ordinality) ON TRUE
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = keys.attnum
            WHERE n.nspname = 'public'
              AND t.relname = 'origin_auth_sessions'
              AND c.contype = 'p'
            LIMIT 1;

            IF pk_name IS NOT NULL AND pk_column <> 'id' THEN
              EXECUTE format('ALTER TABLE origin_auth_sessions DROP CONSTRAINT %I', pk_name);
            END IF;

            IF NOT EXISTS (
              SELECT 1
              FROM pg_constraint c
              JOIN pg_class t ON t.oid = c.conrelid
              JOIN pg_namespace n ON n.oid = t.relnamespace
              WHERE n.nspname = 'public'
                AND t.relname = 'origin_auth_sessions'
                AND c.contype = 'p'
            ) THEN
              ALTER TABLE origin_auth_sessions ADD CONSTRAINT origin_auth_sessions_pkey PRIMARY KEY (id);
            END IF;
          END $$;

          ALTER TABLE origin_auth_sessions ALTER COLUMN access_token DROP NOT NULL;
          ALTER TABLE origin_auth_sessions ALTER COLUMN refresh_token DROP NOT NULL;

          CREATE INDEX IF NOT EXISTS idx_auth_sessions_refresh ON origin_auth_sessions (refresh_token);
          CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_refresh_hash ON origin_auth_sessions (refresh_token_hash);
          CREATE INDEX IF NOT EXISTS idx_auth_sessions_user    ON origin_auth_sessions (user_id);
          CREATE INDEX IF NOT EXISTS idx_auth_sessions_active_user ON origin_auth_sessions (user_id, revoked_at, refresh_token_expires_at);

          CREATE TABLE IF NOT EXISTS origin_tasks (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
            text       TEXT NOT NULL,
            completed  BOOLEAN NOT NULL DEFAULT FALSE,
            due        TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            category   TEXT,
            priority   TEXT CHECK (priority IN ('low', 'medium', 'high'))
          );

          CREATE SCHEMA IF NOT EXISTS app;

          CREATE TABLE IF NOT EXISTS app.tasks (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
            text       TEXT NOT NULL,
            completed  BOOLEAN NOT NULL DEFAULT FALSE,
            due        TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            category   TEXT,
            priority   TEXT CHECK (priority IN ('low', 'medium', 'high')),
            data       JSONB NOT NULL DEFAULT '{}'::jsonb
          );

          INSERT INTO app.tasks (id, user_id, text, completed, due, created_at, category, priority)
          SELECT id, user_id, text, completed, due::TEXT, created_at, category, priority
          FROM origin_tasks
          ON CONFLICT (id) DO NOTHING;

          CREATE INDEX IF NOT EXISTS idx_tasks_user_created ON app.tasks (user_id, created_at DESC);

          CREATE TABLE IF NOT EXISTS origin_media_assets (
            id               TEXT PRIMARY KEY,
            user_id          TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
            purpose          TEXT NOT NULL,
            storage_provider TEXT NOT NULL DEFAULT 'r2',
            bucket           TEXT NOT NULL,
            object_key       TEXT NOT NULL UNIQUE,
            public_url       TEXT NOT NULL,
            mime_type        TEXT NOT NULL,
            size_bytes       INTEGER NOT NULL CHECK (size_bytes > 0),
            sha256           TEXT NOT NULL,
            metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_media_assets_user_purpose_created
            ON origin_media_assets (user_id, purpose, created_at DESC);
        `);
        globalThis.__originUserSchemaEnsured = true;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originUserSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originUserSchemaPromise;
}

// ─── Row → domain type mappers ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToUser(row: any): StoredUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password_hash,
    role: row.role,
    studentClass: row.student_class ?? null,
    fieldOfInterest: row.field_of_interest ?? null,
    referralSource: row.referral_source ?? null,
    avatar: row.avatar ?? null,
    streak: row.streak ?? 0,
    totalStudyTime: row.total_study_time ?? 0,
    joinedAt: row.joined_at instanceof Date ? row.joined_at.toISOString() : String(row.joined_at),
    isPremium: Boolean(row.is_premium),
    premiumExpiry: row.premium_expiry ? (row.premium_expiry instanceof Date ? row.premium_expiry.toISOString() : String(row.premium_expiry)) : null,
    isOnboarded: Boolean(row.is_onboarded),
    selectedCourse: row.selected_course ?? null,
    isDropper: Boolean(row.is_dropper),
    yearsOfExperience: row.years_of_experience ?? null,
    subjects: Array.isArray(row.subjects) ? row.subjects : [],
    studentCapacity: row.student_capacity ?? null,
    location: row.location ?? null,
    voiceMinutesUsedToday: Number(row.voice_minutes_used_today ?? 0),
    tokensUsedToday: Number(row.tokens_used_today ?? 0),
    usageResetAt: row.usage_reset_at instanceof Date ? row.usage_reset_at.toISOString() : String(row.usage_reset_at),
    authTokenVersion: Number(row.auth_token_version ?? 0),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSession(row: any): StoredAuthSession {
  return {
    id: row.id,
    accessToken: row.access_token ?? "",
    accessFingerprint: row.access_fingerprint ?? undefined,
    refreshToken: row.refresh_token ?? "",
    refreshTokenHash: row.refresh_token_hash ?? undefined,
    userId: row.user_id,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    accessTokenExpiresAt: row.access_token_expires_at instanceof Date ? row.access_token_expires_at.toISOString() : String(row.access_token_expires_at),
    refreshTokenExpiresAt: row.refresh_token_expires_at instanceof Date ? row.refresh_token_expires_at.toISOString() : String(row.refresh_token_expires_at),
    revokedAt: row.revoked_at ? (row.revoked_at instanceof Date ? row.revoked_at.toISOString() : String(row.revoked_at)) : null,
    lastUsedAt: row.last_used_at ? (row.last_used_at instanceof Date ? row.last_used_at.toISOString() : String(row.last_used_at)) : null,
    userAgentHash: row.user_agent_hash ?? null,
    ipPrefixHash: row.ip_prefix_hash ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTask(row: any): StoredTask {
  return {
    id: row.id,
    userId: row.user_id,
    text: row.text,
    completed: Boolean(row.completed),
    due: row.due instanceof Date ? row.due.toISOString() : String(row.due),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    category: row.category ?? undefined,
    priority: row.priority ?? undefined,
  };
}

// ─── User operations ──────────────────────────────────────────────────────────

export async function dbFindUserByEmail(email: string, role: string): Promise<StoredUser | null> {
  await ensureUserSchema();
  const result = await pool().query(
    "SELECT * FROM origin_users WHERE LOWER(email) = LOWER($1) AND role = $2 LIMIT 1",
    [email, role],
  );
  return result.rows[0] ? rowToUser(result.rows[0]) : null;
}

export async function dbFindUserById(id: string): Promise<StoredUser | null> {
  await ensureUserSchema();
  const result = await pool().query("SELECT * FROM origin_users WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0] ? rowToUser(result.rows[0]) : null;
}

export async function dbListUsers(): Promise<StoredUser[]> {
  await ensureUserSchema();
  const result = await pool().query("SELECT * FROM origin_users ORDER BY joined_at ASC");
  return result.rows.map(rowToUser);
}

type DbCreateUserInput = Omit<StoredUserWithOptionalDefaults, "id"> & { id?: string };

export async function dbCreateUser(data: DbCreateUserInput): Promise<StoredUser> {
  await ensureUserSchema();
  const id = data.id ?? createId("user");
  const user = withStoredUserDefaults({ ...data, id });
  await pool().query(
    `INSERT INTO origin_users
       (id, name, email, password_hash, role, student_class, field_of_interest,
        referral_source, avatar, streak, total_study_time, joined_at, is_premium,
        premium_expiry, is_onboarded, selected_course, is_dropper,
        years_of_experience, subjects, student_capacity, location,
        voice_minutes_used_today, tokens_used_today, usage_reset_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
    [
      user.id, user.name, user.email, user.password, user.role,
      user.studentClass, user.fieldOfInterest, user.referralSource, user.avatar,
      user.streak, user.totalStudyTime, user.joinedAt, user.isPremium,
      user.premiumExpiry, user.isOnboarded, user.selectedCourse, user.isDropper,
      user.yearsOfExperience, user.subjects, user.studentCapacity, user.location,
      user.voiceMinutesUsedToday, user.tokensUsedToday, user.usageResetAt,
    ],
  );
  return user;
}

export async function dbUpdateUser(id: string, patch: Partial<StoredUser>): Promise<void> {
  await ensureUserSchema();
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  const mapping: Record<string, string> = {
    name: "name", email: "email", password: "password_hash", role: "role",
    studentClass: "student_class", fieldOfInterest: "field_of_interest",
    referralSource: "referral_source", avatar: "avatar", streak: "streak",
    totalStudyTime: "total_study_time", isPremium: "is_premium",
    premiumExpiry: "premium_expiry", isOnboarded: "is_onboarded",
    selectedCourse: "selected_course", isDropper: "is_dropper",
    yearsOfExperience: "years_of_experience", subjects: "subjects",
    studentCapacity: "student_capacity", location: "location",
    voiceMinutesUsedToday: "voice_minutes_used_today", tokensUsedToday: "tokens_used_today",
    usageResetAt: "usage_reset_at", authTokenVersion: "auth_token_version",
  };

  for (const [key, col] of Object.entries(mapping)) {
    if (key in patch) {
      fields.push(`${col} = $${i++}`);
      values.push((patch as Record<string, unknown>)[key]);
    }
  }

  if (fields.length === 0) return;
  values.push(id);
  await pool().query(`UPDATE origin_users SET ${fields.join(", ")} WHERE id = $${i}`, values);
}

export type DbMediaAssetInput = {
  id?: string;
  userId: string;
  purpose: UserImagePurpose;
  storageProvider?: "r2";
  bucket: string;
  objectKey: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  metadata?: Record<string, unknown>;
};

export async function dbCreateMediaAsset(input: DbMediaAssetInput): Promise<{ id: string; createdAt: string }> {
  await ensureUserSchema();
  const id = input.id ?? createId("media");
  const result = await pool().query(
    `INSERT INTO origin_media_assets
       (id, user_id, purpose, storage_provider, bucket, object_key, public_url, mime_type, size_bytes, sha256, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING created_at`,
    [
      id,
      input.userId,
      input.purpose,
      input.storageProvider ?? "r2",
      input.bucket,
      input.objectKey,
      input.publicUrl,
      input.mimeType,
      input.sizeBytes,
      input.sha256,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  const createdAt = result.rows[0]?.created_at;
  return {
    id,
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt ?? new Date().toISOString()),
  };
}

// ─── Auth session operations ──────────────────────────────────────────────────

export async function dbFindUserByAccessToken(accessToken: string): Promise<StoredUser | null> {
  void accessToken;
  return null;
}

export async function dbGetSessionByRefreshToken(refreshToken: string): Promise<StoredAuthSession | null> {
  await ensureUserSchema();
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed) return null;
  const refreshTokenHash = await hashRefreshTokenSecret(parsed.secret);
  const result = await pool().query(
    `SELECT * FROM origin_auth_sessions
     WHERE id = $1
       AND refresh_token_hash = $2
       AND refresh_token_expires_at > NOW()
       AND revoked_at IS NULL
     LIMIT 1`,
    [parsed.sessionId, refreshTokenHash],
  );
  if (!result.rows[0]) return null;
  return { ...rowToSession(result.rows[0]), refreshToken };
}

export async function dbListAuthSessions(): Promise<StoredAuthSession[]> {
  await ensureUserSchema();
  const result = await pool().query(
    "SELECT * FROM origin_auth_sessions WHERE refresh_token_expires_at > NOW() AND revoked_at IS NULL ORDER BY created_at ASC",
  );
  return result.rows.map(rowToSession);
}

export async function dbCreateAuthSession(userId: string): Promise<StoredAuthSession> {
  await ensureUserSchema();
  const user = await dbFindUserById(userId);
  if (!user) {
    throw new Error("Cannot create auth session for missing user.");
  }
  const sessionId = createSessionId();
  const now = new Date();
  const refresh = await createRefreshToken(sessionId);
  const access = await issueAccessTokenForUser(user, sessionId);
  const session: StoredAuthSession = {
    id: sessionId,
    accessToken: access.accessToken,
    accessFingerprint: access.accessFingerprint,
    refreshToken: refresh.refreshToken,
    refreshTokenHash: refresh.refreshTokenHash,
    userId,
    createdAt: now.toISOString(),
    accessTokenExpiresAt: access.accessTokenExpiresAt,
    refreshTokenExpiresAt: refresh.refreshTokenExpiresAt,
    revokedAt: null,
    lastUsedAt: null,
    userAgentHash: null,
    ipPrefixHash: null,
  };

  await pool().query(
    "UPDATE origin_auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND refresh_token_expires_at <= NOW() AND revoked_at IS NULL",
    [userId],
  );
  await pool().query(
    `INSERT INTO origin_auth_sessions
       (id, access_token, access_fingerprint, refresh_token, refresh_token_hash, user_id, created_at,
        access_token_expires_at, refresh_token_expires_at, revoked_at, last_used_at,
        user_agent_hash, ip_prefix_hash)
     VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, NULL, NULL, NULL, NULL)`,
    [
      session.id,
      session.accessToken,
      session.accessFingerprint,
      session.refreshTokenHash,
      session.userId,
      session.createdAt,
      session.accessTokenExpiresAt,
      session.refreshTokenExpiresAt,
    ],
  );
  return session;
}

export async function dbRotateAccessToken(refreshToken: string): Promise<StoredAuthSession | null> {
  await ensureUserSchema();
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed) return null;
  const expectedHash = await hashRefreshTokenSecret(parsed.secret);
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      `SELECT s.*
       FROM origin_auth_sessions s
       WHERE s.id = $1
         AND s.refresh_token_expires_at > NOW()
         AND s.revoked_at IS NULL
       FOR UPDATE OF s`,
      [parsed.sessionId],
    );

    const row = current.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return null;
    }

    let isGraceReplay = false;
    if (row.refresh_token_hash !== expectedHash) {
      const rotatedAtMs = row.refresh_rotated_at ? new Date(row.refresh_rotated_at).getTime() : 0;
      isGraceReplay =
        row.previous_refresh_token_hash === expectedHash &&
        Boolean(row.access_token) &&
        Boolean(row.access_fingerprint) &&
        Number.isFinite(rotatedAtMs) &&
        Date.now() - rotatedAtMs <= REFRESH_REPLAY_GRACE_MS;

      if (!isGraceReplay) {
        await client.query("COMMIT");
        return null;
      }
    }

    const userResult = await client.query("SELECT * FROM origin_users WHERE id = $1 LIMIT 1", [row.user_id]);
    if (!userResult.rows[0]) {
      await client.query("UPDATE origin_auth_sessions SET revoked_at = NOW() WHERE id = $1", [parsed.sessionId]);
      await client.query("COMMIT");
      return null;
    }
    const user = rowToUser(userResult.rows[0]);
    const access = await issueAccessTokenForUser(user, parsed.sessionId);
    const rotateRefresh = shouldRotateRefreshToken(row.refresh_rotated_at, row.created_at, Date.now(), isGraceReplay);

    if (!rotateRefresh) {
      const result = await client.query(
        `UPDATE origin_auth_sessions
         SET access_token = $1,
             access_fingerprint = $2,
             access_token_expires_at = $3,
             last_used_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [
          access.accessToken,
          access.accessFingerprint,
          access.accessTokenExpiresAt,
          parsed.sessionId,
        ],
      );
      await client.query("COMMIT");
      return result.rows[0]
        ? {
            ...rowToSession(result.rows[0]),
            accessToken: access.accessToken,
            accessFingerprint: access.accessFingerprint,
            refreshToken: "",
          }
        : null;
    }

    const refresh = await createRefreshToken(parsed.sessionId);
    const result = await client.query(
      `UPDATE origin_auth_sessions
       SET access_token = $1,
           access_fingerprint = $2,
           refresh_token = NULL,
           previous_refresh_token_hash = refresh_token_hash,
           refresh_token_hash = $3,
           access_token_expires_at = $4,
           refresh_token_expires_at = $5,
           refresh_rotated_at = NOW(),
           last_used_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        access.accessToken,
        access.accessFingerprint,
        refresh.refreshTokenHash,
        access.accessTokenExpiresAt,
        refresh.refreshTokenExpiresAt,
        parsed.sessionId,
      ],
    );
    await client.query("COMMIT");
    return result.rows[0]
      ? {
          ...rowToSession(result.rows[0]),
          accessToken: access.accessToken,
          accessFingerprint: access.accessFingerprint,
          refreshToken: refresh.refreshToken,
          refreshTokenHash: refresh.refreshTokenHash,
        }
      : null;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function dbClearUserSessions(userId: string): Promise<void> {
  await ensureUserSchema();
  await pool().query("UPDATE origin_auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
}

export async function dbRevokeAuthSessionByRefreshToken(refreshToken: string): Promise<void> {
  await ensureUserSchema();
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed) return;
  await pool().query("UPDATE origin_auth_sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL", [
    parsed.sessionId,
  ]);
}

export async function dbIncrementAuthTokenVersionAndRevokeSessions(userId: string): Promise<void> {
  await ensureUserSchema();
  await pool().query("UPDATE origin_users SET auth_token_version = auth_token_version + 1 WHERE id = $1", [userId]);
  await dbClearUserSessions(userId);
}

// ─── Task operations ──────────────────────────────────────────────────────────

export async function dbGetTasks(userId: string): Promise<StoredTask[]> {
  await ensureUserSchema();
  const result = await pool().query(
    "SELECT * FROM app.tasks WHERE user_id = $1 ORDER BY created_at DESC",
    [userId],
  );
  return result.rows.map(rowToTask);
}

export async function dbCreateTask(userId: string, text: string, due: string, category?: string, priority?: string): Promise<StoredTask> {
  await ensureUserSchema();
  const id = createId("task");
  const createdAt = new Date().toISOString();
  await pool().query(
    "INSERT INTO app.tasks (id, user_id, text, completed, due, created_at, updated_at, category, priority, data) VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9::jsonb)",
    [id, userId, text, false, due, createdAt, category ?? null, priority ?? null, JSON.stringify({})],
  );
  return { id, userId, text, completed: false, due, createdAt, category, priority: priority as StoredTask["priority"] };
}

export async function dbUpdateTask(id: string, userId: string, patch: { completed?: boolean; text?: string; due?: string }): Promise<StoredTask | null> {
  await ensureUserSchema();
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if ("completed" in patch) { fields.push(`completed = $${i++}`); values.push(patch.completed); }
  if ("text" in patch)      { fields.push(`text = $${i++}`);      values.push(patch.text); }
  if ("due" in patch)       { fields.push(`due = $${i++}`);       values.push(patch.due); }

  if (fields.length === 0) return null;
  values.push(id, userId);
  const result = await pool().query(
    `UPDATE app.tasks SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${i++} AND user_id = $${i} RETURNING *`,
    values,
  );
  return result.rows[0] ? rowToTask(result.rows[0]) : null;
}

export async function dbDeleteTask(id: string, userId: string): Promise<boolean> {
  await ensureUserSchema();
  const result = await pool().query(
    "DELETE FROM app.tasks WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Login / register helpers (DB-backed) ─────────────────────────────────────

export async function dbLoginUser(email: string, password: string, role: string): Promise<{ user: StoredUser; session: StoredAuthSession } | null> {
  const user = await dbFindUserByEmail(email, role);
  if (!user) return null;
  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return null;
  const session = await dbCreateAuthSession(user.id);
  return { user, session };
}

export async function dbRegisterUser(data: {
  name: string; email: string; password: string; role: string;
  studentClass?: string; fieldOfInterest?: string; referralSource?: string;
}): Promise<{ user: StoredUser; session: StoredAuthSession }> {
  const existing = await dbFindUserByEmail(data.email, data.role);
  if (existing) throw new Error("An account with this email already exists for this role.");

  const id = createId("user");
  const hashed = bcrypt.hashSync(data.password, 10);
  const user = await dbCreateUser({
    id, name: data.name, email: data.email, password: hashed,
    role: data.role as StoredUser["role"],
    studentClass: data.studentClass ?? null, fieldOfInterest: data.fieldOfInterest ?? null,
    referralSource: data.referralSource ?? null, avatar: null, streak: 0, totalStudyTime: 0,
    joinedAt: new Date().toISOString(), isPremium: false, premiumExpiry: null,
    isOnboarded: false, selectedCourse: null, isDropper: false,
    yearsOfExperience: null, subjects: [], studentCapacity: null,
    voiceMinutesUsedToday: 0, tokensUsedToday: 0, usageResetAt: new Date().toISOString(),
  });
  const session = await dbCreateAuthSession(user.id);
  return { user, session };
}

export async function dbUpdateUsageMetrics(userId: string, metrics: { voiceMinutes?: number; tokens?: number }): Promise<{ voiceMinutesUsedToday: number; tokensUsedToday: number }> {
  await ensureUserSchema();
  const { voiceMinutes = 0, tokens = 0 } = metrics;

  // Use a single query with daily reset logic:
  // If usage_reset_at is not today (UTC), reset counters to 0 and update reset time to now.
  // Then add the new usage values.
  const result = await pool().query(
    `UPDATE origin_users
     SET
       voice_minutes_used_today = CASE
         WHEN usage_reset_at < CURRENT_DATE THEN $1::FLOAT
         ELSE voice_minutes_used_today + $1::FLOAT
       END,
       tokens_used_today = CASE
         WHEN usage_reset_at < CURRENT_DATE THEN $2::INTEGER
         ELSE tokens_used_today + $2::INTEGER
       END,
       usage_reset_at = CASE
         WHEN usage_reset_at < CURRENT_DATE THEN NOW()
         ELSE usage_reset_at
       END
     WHERE id = $3
     RETURNING voice_minutes_used_today, tokens_used_today`,
    [voiceMinutes, tokens, userId],
  );

  const row = result.rows[0];
  return {
    voiceMinutesUsedToday: row?.voice_minutes_used_today ?? 0,
    tokensUsedToday: row?.tokens_used_today ?? 0,
  };
}

export async function dbGetUserCount(): Promise<number> {
  await ensureUserSchema();
  const result = await pool().query("SELECT COUNT(*) FROM origin_users");
  return parseInt(result.rows[0].count, 10);
}

export async function dbGetUserCountByRole(role: string): Promise<number> {
  await ensureUserSchema();
  const result = await pool().query(
    "SELECT COUNT(*) FROM origin_users WHERE role = $1",
    [role],
  );
  return parseInt(result.rows[0].count, 10);
}
