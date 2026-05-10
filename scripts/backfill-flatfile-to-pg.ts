import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

type AppStore = Record<string, any[]>;

const ROOT = process.cwd();
const STORE_PATH = path.join(ROOT, ".origin-dev", "server-store.json");
const MIGRATION_PATH = path.join(ROOT, "src", "db", "migrations", "20260504_week2_app_store.sql");
const DRY_RUN = process.argv.includes("--dry-run");
const ALLOW_PRODUCTION = process.argv.includes("--allow-production");

const COLLECTIONS = [
  ["streaks", "streaks", (row: any) => row.userId, (row: any) => row.userId],
  ["dailyActivities", "daily_activities", (row: any) => `${row.userId}:${row.date}`, (row: any) => row.userId, (row: any) => row.date],
  [
    "dailySubjectActivities",
    "daily_subject_activities",
    (row: any) => `${row.userId}:${row.date}:${row.subject}`,
    (row: any) => row.userId,
    (row: any) => row.date,
    (row: any) => row.subject,
  ],
  ["pomodoroSessions", "pomodoro_sessions", (row: any) => row.id, (row: any) => row.userId, (row: any) => dateOnly(row.startTime), null, (row: any) => row.isCompleted],
  ["userScores", "user_scores", (row: any) => row.userId, (row: any) => row.userId],
  ["pointLogs", "point_logs", (row: any) => row.id, (row: any) => row.userId],
  ["testResults", "test_results", (row: any) => row.id, (row: any) => row.userId],
  ["practiceAttempts", "practice_attempts", (row: any) => row.id, (row: any) => row.userId],
  ["dpps", "dpps", (row: any) => row.id, (row: any) => row.userId, null, (row: any) => row.subject, (row: any) => row.completed],
  ["assignments", "assignments", (row: any) => row.id, (row: any) => row.userId, null, (row: any) => row.subject, (row: any) => row.completed],
  ["subjectRanks", "subject_ranks", (row: any) => `${row.userId}:${row.subject}`, (row: any) => row.userId, null, (row: any) => row.subject],
  ["notes", "notes", (row: any) => row.id, (row: any) => row.userId],
  ["bookmarks", "bookmarks", (row: any) => row.id, (row: any) => row.userId],
  ["savedBooks", "saved_books", (row: any) => row.id, (row: any) => row.userId],
  ["doubtSessions", "doubt_sessions", (row: any) => row.id, (row: any) => row.userId, null, (row: any) => row.subject],
  ["originAiProfiles", "origin_ai_profiles", (row: any) => row.userId, (row: any) => row.userId],
  ["originAiSessions", "origin_ai_sessions", (row: any) => row.id, (row: any) => row.userId, null, (row: any) => row.subject],
  ["originAiReminders", "origin_ai_reminders", (row: any) => row.id, (row: any) => row.userId],
  ["otps", "otps", (row: any) => String(row.email).toLowerCase(), () => null],
] as const;

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const raw = trimmed.slice(index + 1).trim();
    process.env[key] ??= raw.replace(/^"|"$/g, "");
  }
}

function connectionString(): string {
  loadEnvFile(path.join(ROOT, ".env.local"));
  const value = process.env.USER_DATABASE_URL ?? process.env.OGCODE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!value) throw new Error("Set USER_DATABASE_URL, OGCODE_DATABASE_URL, or DATABASE_URL before backfill.");
  if (process.env.NODE_ENV === "production" && !ALLOW_PRODUCTION) {
    throw new Error("Refusing production backfill without --allow-production.");
  }
  return value;
}

function dateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function timestamp(value: string | null | undefined): string {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function readStore(): AppStore {
  if (!fs.existsSync(STORE_PATH)) {
    throw new Error(`Flat-file store not found: ${STORE_PATH}`);
  }
  return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as AppStore;
}

async function run(): Promise<void> {
  const store = readStore();
  const pool = new Pool({ connectionString: connectionString(), max: 3 });
  const client = await pool.connect();
  const counts: Record<string, number> = {};

  try {
    await client.query("BEGIN");
    await client.query(fs.readFileSync(MIGRATION_PATH, "utf8"));

    for (const user of store.users ?? []) {
      counts.users = (counts.users ?? 0) + 1;
      if (DRY_RUN) continue;
      await client.query(
        `INSERT INTO origin_users (
           id, name, email, password_hash, role, student_class, field_of_interest,
           referral_source, avatar, streak, total_study_time, joined_at, is_premium,
           premium_expiry, is_onboarded, selected_course, is_dropper,
           years_of_experience, subjects, student_capacity, location,
           voice_minutes_used_today, tokens_used_today, usage_reset_at
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
         ON CONFLICT (id) DO NOTHING`,
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
          user.streak ?? 0,
          user.totalStudyTime ?? 0,
          user.joinedAt ?? new Date().toISOString(),
          Boolean(user.isPremium),
          user.premiumExpiry,
          Boolean(user.isOnboarded),
          user.selectedCourse,
          Boolean(user.isDropper),
          user.yearsOfExperience,
          user.subjects ?? [],
          user.studentCapacity,
          user.location ?? null,
          user.voiceMinutesUsedToday ?? 0,
          user.tokensUsedToday ?? 0,
          user.usageResetAt ?? new Date().toISOString(),
        ],
      );
    }

    for (const task of store.tasks ?? []) {
      counts.tasks = (counts.tasks ?? 0) + 1;
      if (DRY_RUN) continue;
      await client.query(
        `INSERT INTO app.tasks (id, user_id, text, completed, due, created_at, updated_at, category, priority, data)
         VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8,$9::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [
          task.id,
          task.userId,
          task.text,
          Boolean(task.completed),
          task.due,
          task.createdAt ?? new Date().toISOString(),
          task.category ?? null,
          task.priority ?? null,
          JSON.stringify(task),
        ],
      );
    }

    for (const [key, table, idOf, userIdOf, dateOf, subjectOf, completedOf] of COLLECTIONS) {
      for (const row of store[key] ?? []) {
        counts[key] = (counts[key] ?? 0) + 1;
        if (DRY_RUN) continue;
        await client.query(
          `INSERT INTO app.${table} (id, user_id, activity_date, subject, completed, data, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
           ON CONFLICT (id) DO NOTHING`,
          [
            idOf(row),
            userIdOf(row),
            dateOf?.(row) ?? null,
            subjectOf?.(row) ?? null,
            completedOf?.(row) ?? null,
            JSON.stringify(row),
            timestamp(row.createdAt ?? row.timestamp ?? row.startTime),
            timestamp(row.updatedAt ?? row.endTime ?? row.createdAt ?? row.timestamp),
          ],
        );
      }
    }

    if (DRY_RUN) {
      await client.query("ROLLBACK");
    } else {
      await client.query("COMMIT");
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.table(counts);
  console.log(DRY_RUN ? "Dry run complete; no rows were written." : "Backfill complete.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
