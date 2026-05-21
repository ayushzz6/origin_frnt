-- Rollback for 20260521_phase8_teacher_analytics.sql

DROP TABLE IF EXISTS analytics.leaderboard_snapshots;
DROP TABLE IF EXISTS analytics.student_topic_profiles;
DROP TABLE IF EXISTS analytics.batch_topic_snapshots;

DELETE FROM app.migrations WHERE id = '20260521_phase8_teacher_analytics';
