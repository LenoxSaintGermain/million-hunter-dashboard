-- 0024 — client-facing surfaces for property asset classes.
--
-- 1. investor_interest can point at a commercial asset, not just a business deal.
--    Previously InvestorScout wrote a commercial_assets.id into deal_id, which
--    silently produced interest rows resolving to the wrong deal (or none).
-- 2. asset_share_tokens mirrors deal_share_tokens so a property dossier can be
--    shared by link with the same expiry / view-count semantics.

ALTER TABLE `investor_interest` MODIFY COLUMN `deal_id` int NULL;
ALTER TABLE `investor_interest` ADD COLUMN `asset_id` int NULL;

CREATE TABLE IF NOT EXISTS `asset_share_tokens` (
  `id` int AUTO_INCREMENT NOT NULL,
  `token` varchar(64) NOT NULL,
  `asset_id` int NOT NULL,
  `expires_at` bigint NOT NULL,
  `view_count` int NOT NULL DEFAULT 0,
  `created_at` bigint NOT NULL,
  CONSTRAINT `asset_share_tokens_id` PRIMARY KEY(`id`),
  CONSTRAINT `asset_share_tokens_token_unique` UNIQUE(`token`)
);
