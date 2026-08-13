-- 0032 — Capital Aperture risk gates and the Short-Horizon Paper Run preset.
--
-- Two P0 gaps closed:
--   1. An order could be created with no reason, no invalidation condition, no
--      market-hours state, no Paper acknowledgement, and against no notional or
--      concentration ceiling.
--   2. A run could start with no holding period, liquidity floor, catalyst
--      deadline, concentration cap or invalidation rule — the five fields that
--      ARE the mandate.
--
-- Every column here is NULLABLE on purpose. Rows written before the mandate
-- existed carry null, which reads as "pre-mandate, not gated". They are not
-- retroactively failed, and nothing backfills a value the operator never stated.
--
-- The mandate itself (ceilings, holding-period taxonomy, version) lives in
-- server/aperture/mandate.ts. Enforcement is in server/aperture/orderFlow.ts via
-- the pure evaluators in server/aperture/gates.ts — not in the tRPC input schema,
-- which only checks that required fields are present.

-- ── Run preset ──────────────────────────────────────────────────────────────
ALTER TABLE `aperture_runs` ADD COLUMN `holding_period` enum('intraday','overnight','swing','catalyst_window');
ALTER TABLE `aperture_runs` ADD COLUMN `catalyst_deadline_at` bigint;
ALTER TABLE `aperture_runs` ADD COLUMN `liquidity_floor_adv_usd` bigint;
ALTER TABLE `aperture_runs` ADD COLUMN `max_single_name_pct` float;
ALTER TABLE `aperture_runs` ADD COLUMN `invalidation_rule` text;
ALTER TABLE `aperture_runs` ADD COLUMN `mandate_version` varchar(16);

-- ── Order risk gates ────────────────────────────────────────────────────────
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

-- Daily and per-run notional ceilings sum over these two, so both are indexed.
CREATE INDEX `broker_orders_user_created_idx` ON `broker_orders` (`user_id`, `created_at`);
CREATE INDEX `broker_orders_run_idx` ON `broker_orders` (`run_id`);
