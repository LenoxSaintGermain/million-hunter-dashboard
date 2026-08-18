-- The original 0032 risk-gate migration was not applied to this deployed
-- database. These nullable fields preserve legacy orders while allowing the
-- current paper-order queries and gate snapshots to load safely.
ALTER TABLE `broker_orders` ADD COLUMN `reason` text;
ALTER TABLE `broker_orders` ADD COLUMN `invalidation_condition` text;
ALTER TABLE `broker_orders` ADD COLUMN `invalidation_price_cents` bigint;
ALTER TABLE `broker_orders` ADD COLUMN `holding_period` enum('intraday','overnight','swing','catalyst_window');
ALTER TABLE `broker_orders` ADD COLUMN `catalyst_deadline_at` bigint;
ALTER TABLE `broker_orders` ADD COLUMN `market_session` varchar(24);
ALTER TABLE `broker_orders` ADD COLUMN `session_basis` varchar(200);
ALTER TABLE `broker_orders` ADD COLUMN `paper_ack_at` bigint;
ALTER TABLE `broker_orders` ADD COLUMN `gated_notional_cents` bigint;
ALTER TABLE `broker_orders` ADD COLUMN `mandate_version` varchar(16);
ALTER TABLE `broker_orders` ADD COLUMN `gate_snapshot` json;

CREATE INDEX `broker_orders_user_created_idx` ON `broker_orders` (`user_id`, `created_at`);
CREATE INDEX `broker_orders_run_idx` ON `broker_orders` (`run_id`);
