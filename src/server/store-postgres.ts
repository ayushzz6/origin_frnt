import type { PoolClient } from "pg";

import { dbListAuthSessions, dbListUsers, ensureUserSchema } from "@/server/db-users";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import type {
  AppStore,
  StoredAuthSession,
  StoredBookmark,
  StoredDailyActivity,
  StoredDailySubjectActivity,
  StoredDoubtSession,
  StoredDpp,
  StoredNote,
  StoredOriginAiProfileMemory,
  StoredOriginAiReminder,
  StoredOriginAiSession,
  StoredOtp,
  StoredPointLog,
  StoredPomodoroSession,
  StoredPracticeAttempt,
  StoredSavedBook,
  StoredStreakData,
  StoredSubjectRank,
  StoredTask,
  StoredTestResult,
  StoredUser,
  StoredUserScore,
  StoredAssignment,
} from "@/server/store";

export type MutableCollectionKey =
  | "streaks"
  | "dailyActivities"
  | "dailySubjectActivities"
  | "pomodoroSessions"
  | "userScores"
  | "pointLogs"
  | "testResults"
  | "practiceAttempts"
  | "dpps"
  | "assignments"
  | "subjectRanks"
  | "notes"
  | "bookmarks"
  | "savedBooks"
  | "doubtSessions"
  | "originAiProfiles"
  | "originAiSessions"
  | "originAiReminders"
  | "otps";

type MutableCollectionValue = AppStore[MutableCollectionKey][number];

type CollectionSpec<T extends MutableCollectionValue = MutableCollectionValue> = {
  key: MutableCollectionKey;
  table: string;
  idOf: (item: T) => string;
  userIdOf: (item: T) => string | null;
  createdAtOf?: (item: T) => string | null;
  updatedAtOf?: (item: T) => string | null;
  dateOf?: (item: T) => string | null;
  subjectOf?: (item: T) => string | null;
  completedOf?: (item: T) => boolean | null;
};

declare global {
  var __originAppStoreSchemaEnsured: boolean | undefined;
  var __originAppStoreSchemaPromise: Promise<void> | undefined;
}

const APP_STORE_MIGRATION_ID = "20260504_week2_app_store";

const COLLECTION_SPECS: CollectionSpec[] = [
  {
    key: "streaks",
    table: "streaks",
    idOf: (item) => (item as StoredStreakData).userId,
    userIdOf: (item) => (item as StoredStreakData).userId,
    updatedAtOf: (item) => (item as StoredStreakData).lastStudyDate,
  },
  {
    key: "dailyActivities",
    table: "daily_activities",
    idOf: (item) => `${(item as StoredDailyActivity).userId}:${(item as StoredDailyActivity).date}`,
    userIdOf: (item) => (item as StoredDailyActivity).userId,
    dateOf: (item) => (item as StoredDailyActivity).date,
  },
  {
    key: "dailySubjectActivities",
    table: "daily_subject_activities",
    idOf: (item) =>
      `${(item as StoredDailySubjectActivity).userId}:${(item as StoredDailySubjectActivity).date}:${(item as StoredDailySubjectActivity).subject}`,
    userIdOf: (item) => (item as StoredDailySubjectActivity).userId,
    dateOf: (item) => (item as StoredDailySubjectActivity).date,
    subjectOf: (item) => (item as StoredDailySubjectActivity).subject,
  },
  {
    key: "pomodoroSessions",
    table: "pomodoro_sessions",
    idOf: (item) => (item as StoredPomodoroSession).id,
    userIdOf: (item) => (item as StoredPomodoroSession).userId,
    createdAtOf: (item) => (item as StoredPomodoroSession).startTime,
    updatedAtOf: (item) => (item as StoredPomodoroSession).endTime,
    dateOf: (item) => isoDateOnly((item as StoredPomodoroSession).startTime),
    completedOf: (item) => (item as StoredPomodoroSession).isCompleted,
  },
  {
    key: "userScores",
    table: "user_scores",
    idOf: (item) => (item as StoredUserScore).userId,
    userIdOf: (item) => (item as StoredUserScore).userId,
    updatedAtOf: (item) => (item as StoredUserScore).lastUpdated,
  },
  {
    key: "pointLogs",
    table: "point_logs",
    idOf: (item) => (item as StoredPointLog).id,
    userIdOf: (item) => (item as StoredPointLog).userId,
    createdAtOf: (item) => (item as StoredPointLog).timestamp,
  },
  {
    key: "testResults",
    table: "test_results",
    idOf: (item) => (item as StoredTestResult).id,
    userIdOf: (item) => (item as StoredTestResult).userId,
    createdAtOf: (item) => (item as StoredTestResult).createdAt,
  },
  {
    key: "practiceAttempts",
    table: "practice_attempts",
    idOf: (item) => (item as StoredPracticeAttempt).id,
    userIdOf: (item) => (item as StoredPracticeAttempt).userId,
    createdAtOf: (item) => (item as StoredPracticeAttempt).createdAt,
  },
  {
    key: "dpps",
    table: "dpps",
    idOf: (item) => (item as StoredDpp).id,
    userIdOf: (item) => (item as StoredDpp).userId,
    createdAtOf: (item) => (item as StoredDpp).createdAt,
    subjectOf: (item) => (item as StoredDpp).subject,
    completedOf: (item) => (item as StoredDpp).completed,
  },
  {
    key: "assignments",
    table: "assignments",
    idOf: (item) => (item as StoredAssignment).id,
    userIdOf: (item) => (item as StoredAssignment).userId,
    createdAtOf: (item) => (item as StoredAssignment).createdAt,
    subjectOf: (item) => (item as StoredAssignment).subject,
    completedOf: (item) => (item as StoredAssignment).completed,
  },
  {
    key: "subjectRanks",
    table: "subject_ranks",
    idOf: (item) => `${(item as StoredSubjectRank).userId}:${(item as StoredSubjectRank).subject}`,
    userIdOf: (item) => (item as StoredSubjectRank).userId,
    subjectOf: (item) => (item as StoredSubjectRank).subject,
    updatedAtOf: (item) => (item as StoredSubjectRank).updatedAt,
  },
  {
    key: "notes",
    table: "notes",
    idOf: (item) => (item as StoredNote).id,
    userIdOf: (item) => (item as StoredNote).userId,
    createdAtOf: (item) => (item as StoredNote).createdAt,
    updatedAtOf: (item) => (item as StoredNote).updatedAt,
  },
  {
    key: "bookmarks",
    table: "bookmarks",
    idOf: (item) => (item as StoredBookmark).id,
    userIdOf: (item) => (item as StoredBookmark).userId,
    createdAtOf: (item) => (item as StoredBookmark).createdAt,
  },
  {
    key: "savedBooks",
    table: "saved_books",
    idOf: (item) => (item as StoredSavedBook).id,
    userIdOf: (item) => (item as StoredSavedBook).userId,
    createdAtOf: (item) => (item as StoredSavedBook).createdAt,
  },
  {
    key: "doubtSessions",
    table: "doubt_sessions",
    idOf: (item) => (item as StoredDoubtSession).id,
    userIdOf: (item) => (item as StoredDoubtSession).userId,
    createdAtOf: (item) => (item as StoredDoubtSession).createdAt,
    updatedAtOf: (item) => (item as StoredDoubtSession).updatedAt,
    subjectOf: (item) => (item as StoredDoubtSession).subject,
  },
  {
    key: "originAiProfiles",
    table: "origin_ai_profiles",
    idOf: (item) => (item as StoredOriginAiProfileMemory).userId,
    userIdOf: (item) => (item as StoredOriginAiProfileMemory).userId,
    updatedAtOf: (item) => (item as StoredOriginAiProfileMemory).updatedAt,
  },
  {
    key: "originAiSessions",
    table: "origin_ai_sessions",
    idOf: (item) => (item as StoredOriginAiSession).id,
    userIdOf: (item) => (item as StoredOriginAiSession).userId,
    createdAtOf: (item) => (item as StoredOriginAiSession).createdAt,
    updatedAtOf: (item) => (item as StoredOriginAiSession).updatedAt,
    subjectOf: (item) => (item as StoredOriginAiSession).subject,
  },
  {
    key: "originAiReminders",
    table: "origin_ai_reminders",
    idOf: (item) => (item as StoredOriginAiReminder).id,
    userIdOf: (item) => (item as StoredOriginAiReminder).userId,
    createdAtOf: (item) => (item as StoredOriginAiReminder).createdAt,
  },
  {
    key: "otps",
    table: "otps",
    idOf: (item) => (item as StoredOtp).email.toLowerCase(),
    userIdOf: () => null,
    updatedAtOf: (item) => (item as StoredOtp).expiresAt,
  },
];

function pool() {
  const pgPool = getUserPostgresPool();
  if (!pgPool) throw new Error("USER_DATABASE_URL is not configured");
  return pgPool;
}

function isoDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function safeTimestamp(value: string | null | undefined): string {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function pgOnlyFlag(key: string): boolean {
  const envName = `STORE_PG_ONLY_${key.replace(/[A-Z]/g, (match) => `_${match}`).toUpperCase()}`;
  return process.env[envName] === "true";
}

function normalizeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function applyAppStoreMigration(client: PoolClient): Promise<void> {
  const existing = await client.query("SELECT id FROM app.migrations WHERE id = $1", [APP_STORE_MIGRATION_ID]);
  if (existing.rows.length > 0) return;

  await client.query(
    "INSERT INTO app.migrations (id, name, applied_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO NOTHING",
    [APP_STORE_MIGRATION_ID, "week2 app store tables"],
  );
}

export async function ensureAppStoreSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originAppStoreSchemaEnsured) return;
  if (!globalThis.__originAppStoreSchemaPromise) {
    globalThis.__originAppStoreSchemaPromise = (async () => {
      await ensureUserSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");
        await client.query(`
          CREATE SCHEMA IF NOT EXISTS app;

          CREATE TABLE IF NOT EXISTS app.migrations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);

        for (const spec of COLLECTION_SPECS) {
          await client.query(`
            CREATE TABLE IF NOT EXISTS app.${spec.table} (
              id TEXT PRIMARY KEY,
              user_id TEXT REFERENCES origin_users(id) ON DELETE CASCADE,
              activity_date DATE,
              subject TEXT,
              completed BOOLEAN,
              data JSONB NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
          `);
          await client.query(`CREATE INDEX IF NOT EXISTS idx_${spec.table}_user_created ON app.${spec.table} (user_id, created_at DESC)`);
        }

        await client.query(`
          CREATE TABLE IF NOT EXISTS app.tasks (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            completed BOOLEAN NOT NULL DEFAULT FALSE,
            due TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            category TEXT,
            priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
            data JSONB NOT NULL DEFAULT '{}'::jsonb
          );

          CREATE INDEX IF NOT EXISTS idx_tasks_user_created ON app.tasks (user_id, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_daily_activities_user_date ON app.daily_activities (user_id, activity_date);
          CREATE INDEX IF NOT EXISTS idx_daily_subject_activities_user_date ON app.daily_subject_activities (user_id, activity_date);
          CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_date ON app.pomodoro_sessions (user_id, activity_date);
          CREATE UNIQUE INDEX IF NOT EXISTS idx_subject_ranks_user_subject ON app.subject_ranks (user_id, subject);
        `);

        await applyAppStoreMigration(client);
        await client.query("COMMIT");
        globalThis.__originAppStoreSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originAppStoreSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originAppStoreSchemaPromise;
}

async function upsertUsers(client: PoolClient, users: StoredUser[]): Promise<void> {
  for (const user of users) {
    await client.query(
      `INSERT INTO origin_users (
         id, name, email, password_hash, role, student_class, field_of_interest,
         referral_source, avatar, streak, total_study_time, joined_at, is_premium,
         premium_expiry, is_onboarded, selected_course, is_dropper,
         years_of_experience, subjects, student_capacity, location,
         voice_minutes_used_today, tokens_used_today, usage_reset_at, auth_token_version
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         student_class = EXCLUDED.student_class,
         field_of_interest = EXCLUDED.field_of_interest,
         referral_source = EXCLUDED.referral_source,
         avatar = EXCLUDED.avatar,
         streak = EXCLUDED.streak,
         total_study_time = EXCLUDED.total_study_time,
         is_premium = EXCLUDED.is_premium,
         premium_expiry = EXCLUDED.premium_expiry,
         is_onboarded = EXCLUDED.is_onboarded,
         selected_course = EXCLUDED.selected_course,
         is_dropper = EXCLUDED.is_dropper,
         years_of_experience = EXCLUDED.years_of_experience,
         subjects = EXCLUDED.subjects,
         student_capacity = EXCLUDED.student_capacity,
         location = EXCLUDED.location,
         voice_minutes_used_today = EXCLUDED.voice_minutes_used_today,
         tokens_used_today = EXCLUDED.tokens_used_today,
         usage_reset_at = EXCLUDED.usage_reset_at,
         auth_token_version = EXCLUDED.auth_token_version`,
      [
        user.id,
        user.name,
        user.email,
        user.password,
        user.role,
        user.studentClass,
        user.fieldOfInterest,
        user.referralSource,
        user.avatar,
        user.streak,
        user.totalStudyTime,
        user.joinedAt,
        user.isPremium,
        user.premiumExpiry,
        user.isOnboarded,
        user.selectedCourse,
        user.isDropper,
        user.yearsOfExperience,
        user.subjects,
        user.studentCapacity,
        user.location,
        user.voiceMinutesUsedToday,
        user.tokensUsedToday,
        user.usageResetAt,
        user.authTokenVersion,
      ],
    );
  }
}

async function replaceAuthSessions(client: PoolClient, sessions: StoredAuthSession[]): Promise<void> {
  await client.query("DELETE FROM origin_auth_sessions");
  for (const session of sessions) {
    await client.query(
      `INSERT INTO origin_auth_sessions (
         id, access_token, access_fingerprint, refresh_token, refresh_token_hash, user_id, created_at,
         access_token_expires_at, refresh_token_expires_at, revoked_at, last_used_at,
         user_agent_hash, ip_prefix_hash
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         access_fingerprint = EXCLUDED.access_fingerprint,
         refresh_token = EXCLUDED.refresh_token,
         refresh_token_hash = EXCLUDED.refresh_token_hash,
         user_id = EXCLUDED.user_id,
         access_token_expires_at = EXCLUDED.access_token_expires_at,
         refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
         revoked_at = EXCLUDED.revoked_at,
         last_used_at = EXCLUDED.last_used_at,
         user_agent_hash = EXCLUDED.user_agent_hash,
         ip_prefix_hash = EXCLUDED.ip_prefix_hash`,
      [
        session.id,
        session.accessToken,
        session.accessFingerprint ?? null,
        session.refreshToken,
        session.refreshTokenHash ?? null,
        session.userId,
        session.createdAt,
        session.accessTokenExpiresAt,
        session.refreshTokenExpiresAt,
        session.revokedAt ?? null,
        session.lastUsedAt ?? null,
        session.userAgentHash ?? null,
        session.ipPrefixHash ?? null,
      ],
    );
  }
}

async function loadTasks(): Promise<StoredTask[]> {
  const result = await pool().query("SELECT * FROM app.tasks ORDER BY created_at DESC");
  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    text: row.text,
    completed: Boolean(row.completed),
    due: row.due,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    category: row.category ?? undefined,
    priority: row.priority ?? undefined,
  }));
}

async function replaceTasks(client: PoolClient, tasks: StoredTask[]): Promise<void> {
  await client.query("DELETE FROM app.tasks");
  for (const task of tasks) {
    await client.query(
      `INSERT INTO app.tasks (
         id, user_id, text, completed, due, created_at, updated_at, category, priority, data
       ) VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8,$9::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         text = EXCLUDED.text,
         completed = EXCLUDED.completed,
         due = EXCLUDED.due,
         category = EXCLUDED.category,
         priority = EXCLUDED.priority,
         data = EXCLUDED.data,
         updated_at = NOW()`,
      [
        task.id,
        task.userId,
        task.text,
        task.completed,
        task.due,
        task.createdAt,
        task.category ?? null,
        task.priority ?? null,
        JSON.stringify(normalizeJson(task)),
      ],
    );
  }
}

async function loadCollection<T extends MutableCollectionValue>(spec: CollectionSpec<T>): Promise<T[]> {
  const result = await pool().query(`SELECT data FROM app.${spec.table} ORDER BY created_at DESC`);
  return result.rows.map((row) => row.data as T);
}

// One row maps to 8 columns; Postgres caps a statement at 65535 bind params, so
// keep each multi-row INSERT well under that with a conservative chunk size.
const COLLECTION_INSERT_COLUMNS = 8;
const COLLECTION_INSERT_CHUNK = 500;

function collectionRowParams<T extends MutableCollectionValue>(spec: CollectionSpec<T>, item: T): unknown[] {
  return [
    spec.idOf(item),
    spec.userIdOf(item),
    spec.dateOf?.(item) ?? null,
    spec.subjectOf?.(item) ?? null,
    spec.completedOf?.(item) ?? null,
    JSON.stringify(normalizeJson(item)),
    safeTimestamp(spec.createdAtOf?.(item)),
    safeTimestamp(spec.updatedAtOf?.(item) ?? spec.createdAtOf?.(item)),
  ];
}

// Pure builder for the chunked multi-row upsert statements. Exported for unit
// testing because the per-chunk placeholder numbering ($1..$N) is easy to get
// subtly wrong. `rows` are already in column order (see collectionRowParams);
// column 6 (data) is cast to ::jsonb.
export function buildCollectionInsertChunks(
  table: string,
  rows: unknown[][],
  chunkSize: number = COLLECTION_INSERT_CHUNK,
): Array<{ text: string; values: unknown[] }> {
  const safeChunk = Math.max(1, chunkSize);
  const chunks: Array<{ text: string; values: unknown[] }> = [];
  for (let start = 0; start < rows.length; start += safeChunk) {
    const slice = rows.slice(start, start + safeChunk);
    const tuples: string[] = [];
    const values: unknown[] = [];
    slice.forEach((row, index) => {
      const base = index * COLLECTION_INSERT_COLUMNS;
      tuples.push(
        `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6}::jsonb,$${base + 7},$${base + 8})`,
      );
      values.push(...row);
    });
    chunks.push({
      text: `INSERT INTO app.${table} (
         id, user_id, activity_date, subject, completed, data, created_at, updated_at
       ) VALUES ${tuples.join(",")}
       ON CONFLICT (id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         activity_date = EXCLUDED.activity_date,
         subject = EXCLUDED.subject,
         completed = EXCLUDED.completed,
         data = EXCLUDED.data,
         created_at = EXCLUDED.created_at,
         updated_at = EXCLUDED.updated_at`,
      values,
    });
  }
  return chunks;
}

// Batched, idempotent upsert of collection rows. Replaces the previous
// one-INSERT-per-row loop (N round-trips) with a single multi-row INSERT per
// chunk, which is the dominant cost of persisting the store.
async function upsertCollectionRows<T extends MutableCollectionValue>(
  client: PoolClient,
  spec: CollectionSpec<T>,
  items: T[],
): Promise<void> {
  const rows = items.map((item) => collectionRowParams(spec, item));
  for (const chunk of buildCollectionInsertChunks(spec.table, rows)) {
    await client.query(chunk.text, chunk.values);
  }
}

async function replaceCollection<T extends MutableCollectionValue>(
  client: PoolClient,
  spec: CollectionSpec<T>,
  items: T[],
): Promise<void> {
  await client.query(`DELETE FROM app.${spec.table}`);
  await upsertCollectionRows(client, spec, items);
}

export async function hydrateStoreFromPostgres(seed: AppStore): Promise<AppStore> {
  if (!isUserPostgresConfigured()) return seed;

  await ensureAppStoreSchema();

  const specs = COLLECTION_SPECS;
  const results = await Promise.all([
    dbListUsers(),
    dbListAuthSessions(),
    loadTasks(),
    ...specs.map((spec) => loadCollection(spec)),
  ]);

  const users = results[0] as StoredUser[];
  const sessions = results[1] as StoredAuthSession[];
  const tasks = results[2] as StoredTask[];
  const collectionRows = results.slice(3) as MutableCollectionValue[][];

  const store = normalizeJson(seed);

  if (users.length > 0) {
    const merged = new Map(store.users.map((user) => [user.id, user]));
    for (const user of users) {
      merged.set(user.id, user);
    }
    store.users = [...merged.values()];
  }
  store.authSessions = sessions;
  store.tasks = tasks.length > 0 || pgOnlyFlag("tasks") ? tasks : store.tasks;

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const rows = collectionRows[i];
    if (rows.length > 0 || pgOnlyFlag(spec.key)) {
      (store[spec.key] as MutableCollectionValue[]) = rows;
    }
  }

  return store;
}

export async function persistStoreToPostgres(store: AppStore): Promise<void> {
  if (!isUserPostgresConfigured()) return;

  await ensureAppStoreSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await upsertUsers(client, store.users);
    await replaceAuthSessions(client, store.authSessions);
    await replaceTasks(client, store.tasks);
    for (const spec of COLLECTION_SPECS) {
      await replaceCollection(client, spec, store[spec.key] as MutableCollectionValue[]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

// Persist only the rows that belong to a single user across the given
// collections (plus, optionally, that user's row in origin_users). Unlike
// persistStoreToPostgres this never `DELETE`s a whole table and never rewrites
// other users' rows, so its cost scales with the one user's data rather than
// with total database size. Use it for hot per-user write paths (test submit,
// practice submit, etc.) whose only durable side-effects are scoped to the
// acting user; the primary records for those flows are written through their own
// targeted writers (e.g. persistTestAnalysisResult).
export async function persistUserCollections(
  store: AppStore,
  userId: string,
  keys: MutableCollectionKey[],
  options: { persistUser?: boolean } = {},
): Promise<void> {
  if (!isUserPostgresConfigured()) return;

  const specs = COLLECTION_SPECS.filter((spec) => keys.includes(spec.key));
  if (specs.length === 0 && !options.persistUser) return;

  await ensureAppStoreSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    if (options.persistUser) {
      const user = store.users.find((entry) => entry.id === userId);
      if (user) {
        await upsertUsers(client, [user]);
      }
    }
    for (const spec of specs) {
      const rows = (store[spec.key] as MutableCollectionValue[]).filter(
        (item) => spec.userIdOf(item) === userId,
      );
      await upsertCollectionRows(client, spec, rows);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
