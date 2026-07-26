ALTER TABLE `commercial_assets` ADD `asset_class` varchar(64) DEFAULT 'historic';--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `class_metadata` json;