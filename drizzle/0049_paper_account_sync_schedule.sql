-- 0049 — owner-scoped paper-account synchronization schedule.
--
-- The callback resolves an account only by its immutable platform task UID and
-- accepts Alpaca Paper accounts only. It reads account/position context; it has
-- no order proposal, approval, submission, or broker-order path.
ALTER TABLE `portfolio_accounts`
  ADD COLUMN `sync_schedule_task_uid` varchar(96),
  ADD COLUMN `sync_schedule_enabled` boolean NOT NULL DEFAULT false,
  ADD COLUMN `sync_schedule_last_run_at` bigint,
  ADD COLUMN `sync_schedule_last_result` text;

CREATE INDEX `portfolio_accounts_sync_schedule_task_uid_idx`
  ON `portfolio_accounts` (`sync_schedule_task_uid`);
