ALTER TABLE `commercial_assets` ADD `last_verified_at` bigint;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `listing_status` varchar(24);--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `verification_note` text;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `verification_sources` json;