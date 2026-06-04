-- Rollback for 20260604_phase14_enrollment_subscriptions.sql
DROP TABLE IF EXISTS app.connect_jobs CASCADE;
DROP TABLE IF EXISTS commerce.subscription_webhook_events CASCADE;
DROP TABLE IF EXISTS commerce.enrollment_subscriptions CASCADE;
ALTER TABLE commerce.workspace_offerings DROP COLUMN IF EXISTS billing_period;
ALTER TABLE commerce.workspace_offerings DROP COLUMN IF EXISTS razorpay_plan_id;
DELETE FROM app.migrations WHERE id = '20260604_phase14_enrollment_subscriptions';
