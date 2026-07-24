ALTER TABLE `commercial_assets` ADD `year_built` int;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `stories` int;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `is_historic` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `historic_register_eligible` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `is_stabilized` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `occupancy_rate` float;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `has_air_rights` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `lot_sq_ft` int;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `higher_and_better_use_notes` text;