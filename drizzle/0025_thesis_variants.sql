-- 0025 — variant theses + asset assignment.
--
-- From the Wingate call: a building that FAILS Chad's thesis can be exactly
-- right for one of his clients (relaxed storey cap, different vintage, other
-- geography). Rather than forking the scorer per client, a variant stores
-- overrides on the same scoring model and every asset is evaluated against all
-- of them — so "fails Wingate, fits Cincinnati Restoration" becomes visible
-- instead of the asset being silently archived.
--
-- assigned_user_id lets an operator hand a specific asset to a specific client.

CREATE TABLE IF NOT EXISTS `thesis_variants` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(120) NOT NULL,
  `description` text,
  `asset_class` varchar(64) NOT NULL DEFAULT 'historic',
  `overrides` json,
  `client_label` varchar(160),
  `owner_user_id` int,
  `assigned_user_id` int,
  `is_primary` boolean NOT NULL DEFAULT false,
  `is_active` boolean NOT NULL DEFAULT true,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  CONSTRAINT `thesis_variants_id` PRIMARY KEY(`id`)
);

ALTER TABLE `commercial_assets` ADD COLUMN `assigned_user_id` int NULL;
ALTER TABLE `commercial_assets` ADD COLUMN `assignment_note` text NULL;
