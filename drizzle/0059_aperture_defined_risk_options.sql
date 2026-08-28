ALTER TABLE `portfolio_accounts`
  ADD COLUMN `options_approved_level` int,
  ADD COLUMN `options_trading_level` int,
  ADD COLUMN `options_buying_power_cents` bigint;

ALTER TABLE `aperture_active_play_contexts`
  ADD COLUMN `instrument_type` enum('shares','long_call','long_put') NOT NULL DEFAULT 'shares',
  ADD COLUMN `underlying_symbol` varchar(24),
  ADD COLUMN `option_expiration_date` varchar(10),
  ADD COLUMN `option_strike_price_cents` bigint,
  ADD COLUMN `contract_multiplier` int;

ALTER TABLE `broker_orders`
  ADD COLUMN `instrument_type` enum('shares','long_call','long_put') NOT NULL DEFAULT 'shares',
  ADD COLUMN `underlying_symbol` varchar(24),
  ADD COLUMN `option_expiration_date` varchar(10),
  ADD COLUMN `option_strike_price_cents` bigint,
  ADD COLUMN `contract_multiplier` int,
  ADD COLUMN `instrument_snapshot` json;

ALTER TABLE `aperture_runs`
  MODIFY COLUMN `holding_period` enum('intraday','overnight','swing','catalyst_window','position');

ALTER TABLE `aperture_decision_revisions`
  MODIFY COLUMN `holding_period` enum('intraday','overnight','swing','catalyst_window','position') NOT NULL;

ALTER TABLE `broker_orders`
  MODIFY COLUMN `holding_period` enum('intraday','overnight','swing','catalyst_window','position');

ALTER TABLE `aperture_alpha`
  MODIFY COLUMN `holding_period` enum('intraday','overnight','swing','catalyst_window','position');
