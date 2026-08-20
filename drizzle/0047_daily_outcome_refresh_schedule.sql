-- Owner-scoped Heartbeat identity and observable state for deterministic, paper-only
-- Capital outcome refreshes. Additive; it does not touch orders or brokerage records.
ALTER TABLE users ADD COLUMN daily_outcome_refresh_task_uid varchar(65) NULL;
ALTER TABLE users ADD COLUMN daily_outcome_refresh_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN daily_outcome_refresh_last_run_at bigint NULL;
ALTER TABLE users ADD COLUMN daily_outcome_refresh_last_result text NULL;
CREATE UNIQUE INDEX users_daily_outcome_refresh_task_uid_uq ON users (daily_outcome_refresh_task_uid);
