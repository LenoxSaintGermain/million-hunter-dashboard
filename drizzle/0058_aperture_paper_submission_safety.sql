ALTER TABLE `portfolio_accounts`
  ADD UNIQUE KEY `portfolio_accounts_broker_external_uq` (`broker_id`, `external_account_id`);

ALTER TABLE `broker_orders`
  ADD COLUMN `portfolio_context_account_id` INT NULL AFTER `account_id`,
  ADD COLUMN `last_preflight_at` BIGINT NULL AFTER `gate_snapshot`,
  ADD COLUMN `last_preflight_snapshot` JSON NULL AFTER `last_preflight_at`,
  ADD COLUMN `approval_confirmed_at` BIGINT NULL AFTER `last_preflight_snapshot`,
  ADD COLUMN `submit_confirmed_at` BIGINT NULL AFTER `approval_confirmed_at`;
