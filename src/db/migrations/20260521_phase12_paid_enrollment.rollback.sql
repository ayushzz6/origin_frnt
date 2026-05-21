-- Rollback for 20260521_phase12_paid_enrollment.sql

DROP TABLE IF EXISTS commerce.enrollment_orders;
DROP TABLE IF EXISTS commerce.workspace_offerings;
DROP TYPE IF EXISTS commerce.order_status;

DELETE FROM app.migrations WHERE id = '20260521_phase12_paid_enrollment';
