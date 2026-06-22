CREATE TABLE `ripple_favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`location` varchar(255) NOT NULL,
	`anchor_type` varchar(64),
	`project_name` varchar(255),
	`signal_snapshot` json NOT NULL,
	`plays_json` json,
	`gap_analysis_json` json,
	`pipeline_status` enum('none','queued','running','done','error') NOT NULL DEFAULT 'none',
	`created_at` bigint NOT NULL,
	CONSTRAINT `ripple_favorites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ripple_pipeline_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`favorite_id` int NOT NULL,
	`user_id` int NOT NULL,
	`status` enum('queued','running','done','error') NOT NULL DEFAULT 'queued',
	`current_step` varchar(64),
	`market_scan_results` json,
	`tide_signals` json,
	`ic_verdict` json,
	`error_message` text,
	`created_at` bigint NOT NULL,
	`completed_at` bigint,
	CONSTRAINT `ripple_pipeline_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ripple_scan_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`location` varchar(255) NOT NULL,
	`query_hash` varchar(64) NOT NULL,
	`results_json` json NOT NULL,
	`signal_count` int NOT NULL DEFAULT 0,
	`created_at` bigint NOT NULL,
	`expires_at` bigint NOT NULL,
	CONSTRAINT `ripple_scan_cache_id` PRIMARY KEY(`id`)
);
