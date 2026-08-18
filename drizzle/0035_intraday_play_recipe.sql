-- Structured intraday recipe controls. Nullable to preserve historical orders;
-- server gates require these fields for newly created intraday proposals only.
ALTER TABLE `broker_orders` ADD COLUMN `entry_price_cents` bigint;
ALTER TABLE `broker_orders` ADD COLUMN `stop_price_cents` bigint;
ALTER TABLE `broker_orders` ADD COLUMN `slippage_cents` bigint;
ALTER TABLE `broker_orders` ADD COLUMN `planned_risk_cents` bigint;
ALTER TABLE `broker_orders` ADD COLUMN `time_stop_at` bigint;
ALTER TABLE `broker_orders` ADD COLUMN `no_trade_conditions` json;
