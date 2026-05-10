CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS app.streaks (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES origin_users(id) ON DELETE CASCADE,
  activity_date DATE,
  subject TEXT,
  completed BOOLEAN,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.daily_activities (LIKE app.streaks INCLUDING ALL);
CREATE TABLE IF NOT EXISTS app.daily_subject_activities (LIKE app.streaks INCLUDING ALL);
CREATE TABLE IF NOT EXISTS app.pomodoro_sessions (LIKE app.streaks INCLUDING ALL);
CREATE TABLE IF NOT EXISTS app.user_scores (LIKE app.streaks INCLUDING ALL);
CREATE TABLE IF NOT EXISTS app.point_logs (LIKE app.streaks INCLUDING ALL);
CREATE TABLE IF NOT EXISTS app.test_results (LIKE app.streaks INCLUDING ALL);
CREATE TABLE IF NOT EXISTS app.practice_attempts (LIKE app.streaks INCLUDING ALL);
CREATE TABLE IF NOT EXISTS app.dpps (LIKE app.streaks INCLUDING ALL);
CREATE TABLE IF NOT EXISTS app.assignments (LIKE app.streaks INCLUDING ALL);
CREATE TABLE IF NOT EXISTS app.subject_ranks (LIKE app.streaks INCLUDING ALL);
CREATE TABLE IF NOT EXISTS app.notes (LIKE app.streaks INCLUDING ALL);
CREATE TABLE IF NOT EXISTS app.bookmarks (LIKE app.streaks INCLUDING ALL);
CREATE TABLE IF NOT EXISTS app.saved_books (LIKE app.streaks INCLUDING ALL);
CREATE TABLE IF NOT EXISTS app.doubt_sessions (LIKE app.streaks INCLUDING ALL);
CREATE TABLE IF NOT EXISTS app.origin_ai_profiles (LIKE app.streaks INCLUDING ALL);
CREATE TABLE IF NOT EXISTS app.origin_ai_sessions (LIKE app.streaks INCLUDING ALL);
CREATE TABLE IF NOT EXISTS app.origin_ai_reminders (LIKE app.streaks INCLUDING ALL);
CREATE TABLE IF NOT EXISTS app.otps (LIKE app.streaks INCLUDING ALL);

CREATE INDEX IF NOT EXISTS idx_streaks_user_created ON app.streaks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_activities_user_created ON app.daily_activities (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_subject_activities_user_created ON app.daily_subject_activities (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_created ON app.pomodoro_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_scores_user_created ON app.user_scores (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_logs_user_created ON app.point_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_results_user_created ON app.test_results (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_user_created ON app.practice_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dpps_user_created ON app.dpps (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_user_created ON app.assignments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subject_ranks_user_created ON app.subject_ranks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_user_created ON app.notes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created ON app.bookmarks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_books_user_created ON app.saved_books (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doubt_sessions_user_created ON app.doubt_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_origin_ai_profiles_user_created ON app.origin_ai_profiles (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_origin_ai_sessions_user_created ON app.origin_ai_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_origin_ai_reminders_user_created ON app.origin_ai_reminders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otps_user_created ON app.otps (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_activities_user_date ON app.daily_activities (user_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_daily_subject_activities_user_date ON app.daily_subject_activities (user_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_date ON app.pomodoro_sessions (user_id, activity_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subject_ranks_user_subject ON app.subject_ranks (user_id, subject);

INSERT INTO app.migrations (id, name)
VALUES ('20260504_week2_app_store', 'week2 app store tables')
ON CONFLICT (id) DO NOTHING;
