-- 0033 — Pilot scorecard: baseline, benchmark, sample size, horizon.
--
-- aperture_alpha could already say "system P&L was +$400". It could not say what
-- that was measured against, over what window, or on how many closed trades —
-- which makes the number unusable as evidence and, if it were ever shown to a
-- stakeholder, misleading.
--
-- Four gaps closed, plus two review findings the metric was silently carrying:
--   · selection bias — the operator approves system candidates before they fill,
--     so "system P&L" is human-filtered. The pre-approval set is now counted.
--   · paper fills flatter — no slippage, no partials, no queue position. At short
--     horizons that IS the edge, so the assumption is stored with the figures.
--
-- All nullable: rows computed before this carry null, and nothing backfills a
-- figure that was never measured. Computation lives in server/aperture/
-- scorecard.ts (pure, unit-tested); alpha.ts is the I/O around it.

ALTER TABLE `aperture_alpha` ADD COLUMN `system_surfaced_count` int;
ALTER TABLE `aperture_alpha` ADD COLUMN `system_declined_count` int;
ALTER TABLE `aperture_alpha` ADD COLUMN `selection_bias_note` text;

ALTER TABLE `aperture_alpha` ADD COLUMN `baseline_kind` enum('human_intended','cash_only');
ALTER TABLE `aperture_alpha` ADD COLUMN `baseline_pnl_cents` bigint;
ALTER TABLE `aperture_alpha` ADD COLUMN `baseline_note` text;

ALTER TABLE `aperture_alpha` ADD COLUMN `benchmark_symbol` varchar(24);
ALTER TABLE `aperture_alpha` ADD COLUMN `benchmark_return_bps` int;
ALTER TABLE `aperture_alpha` ADD COLUMN `benchmark_basis` enum('verified','modeled','unknown');
ALTER TABLE `aperture_alpha` ADD COLUMN `benchmark_note` text;

ALTER TABLE `aperture_alpha` ADD COLUMN `filled_order_count` int;
ALTER TABLE `aperture_alpha` ADD COLUMN `closed_trade_count` int;
ALTER TABLE `aperture_alpha` ADD COLUMN `sample_sufficiency` enum('process_only','indicative','edge_capable');
ALTER TABLE `aperture_alpha` ADD COLUMN `sample_note` text;

ALTER TABLE `aperture_alpha` ADD COLUMN `horizon_start_at` bigint;
ALTER TABLE `aperture_alpha` ADD COLUMN `horizon_end_at` bigint;
ALTER TABLE `aperture_alpha` ADD COLUMN `horizon_days` float;
ALTER TABLE `aperture_alpha` ADD COLUMN `holding_period` enum('intraday','overnight','swing','catalyst_window');

ALTER TABLE `aperture_alpha` ADD COLUMN `slippage_assumption` text;
