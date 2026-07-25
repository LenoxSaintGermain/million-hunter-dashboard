ALTER TABLE `commercial_assets` ADD `thesis_compilation_id` int;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `dim_a` int;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `dim_b` int;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `dim_c` int;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `dim_d` int;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `dim_e` int;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `dim_f` int;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `dim_g` int;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `composite_score` int;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `penalties` int;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `bonuses` int;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `confidence_score` float;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `rank_score` float;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `asset_tier` varchar(16);--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `market_tier` varchar(4);--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `disposition_code` varchar(8);--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `verify_fields` json;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `historic_inputs` json;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `scorecard` json;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `is_archived` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `archived_at` bigint;--> statement-breakpoint
ALTER TABLE `deals` ADD `is_synthetic` boolean DEFAULT false NOT NULL;