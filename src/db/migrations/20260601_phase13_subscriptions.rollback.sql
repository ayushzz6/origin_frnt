-- Rollback for 20260601_phase13_subscriptions.sql

DROP TABLE IF EXISTS subscriptions.webhook_events;
DROP TABLE IF EXISTS subscriptions.user_subscriptions;
DROP TYPE IF EXISTS subscriptions.subscription_status;

DELETE FROM app.migrations WHERE id = '20260601_phase13_subscriptions';
