-- 0027 — off-market sourcing from public records.
--
-- Listing-site sourcing competes for the same inventory a CoStar seat shows.
-- These columns hold the second axis: public-record distress and ownership
-- signals, plus a motivation score answering "is this owner likely to sell?"
-- kept deliberately separate from the thesis score ("is this the right
-- building?").

ALTER TABLE `commercial_assets` ADD COLUMN `is_off_market` boolean NOT NULL DEFAULT false;
ALTER TABLE `commercial_assets` ADD COLUMN `off_market_signals` json;
ALTER TABLE `commercial_assets` ADD COLUMN `motivation_score` int;
