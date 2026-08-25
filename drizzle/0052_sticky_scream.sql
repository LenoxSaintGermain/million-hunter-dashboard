CREATE TABLE `aperture_alpha` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` int NOT NULL,
	`user_id` int NOT NULL,
	`human_opportunity_set_count` int NOT NULL DEFAULT 0,
	`system_added_count` int NOT NULL DEFAULT 0,
	`system_filled_count` int NOT NULL DEFAULT 0,
	`human_pnl_cents` bigint,
	`system_pnl_cents` bigint,
	`max_drawdown_bps` int,
	`hhi_before` float,
	`hhi_after` float,
	`capital_utilization_pct` float,
	`metric_basis` enum('verified','modeled','mixed') NOT NULL DEFAULT 'modeled',
	`last_computed_at` bigint,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `aperture_alpha_id` PRIMARY KEY(`id`),
	CONSTRAINT `aperture_alpha_run_id_unique` UNIQUE(`run_id`)
);
--> statement-breakpoint
CREATE TABLE `aperture_candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` int NOT NULL,
	`symbol` varchar(24) NOT NULL,
	`role` enum('core','complementary','remainder','alternative_expression') NOT NULL,
	`composite_score` int,
	`confidence_score` float,
	`rank_score` float,
	`dimensions` json,
	`verify_fields` json DEFAULT ('[]'),
	`exposure_node_ids` json DEFAULT ('[]'),
	`memo` json,
	`memo_status` enum('pending','ok','rejected','skipped') NOT NULL DEFAULT 'pending',
	`memo_reject_reason` text,
	`citations` json DEFAULT ('[]'),
	`suggested_size_low_cents` bigint,
	`suggested_size_high_cents` bigint,
	`created_at` bigint NOT NULL,
	CONSTRAINT `aperture_candidates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aperture_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`thesis_id` int NOT NULL,
	`account_id` int,
	`deployable_capital_cents` bigint NOT NULL,
	`intended_trades` json DEFAULT ('[]'),
	`hurdle_rate_bps` int,
	`status` enum('queued','compiling','discovering','researching','scoring','constructing','completed','failed') NOT NULL DEFAULT 'queued',
	`universe_count` int,
	`candidate_count` int,
	`dropped_note` text,
	`provider_availability` json,
	`error` text,
	`started_at` bigint,
	`completed_at` bigint,
	`created_at` bigint NOT NULL,
	CONSTRAINT `aperture_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aperture_strategies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` int NOT NULL,
	`kind` enum('concentrated','expanded','risk_balanced','dry_powder','human_baseline') NOT NULL,
	`label` varchar(120) NOT NULL,
	`rationale` text,
	`allocations` json DEFAULT ('[]'),
	`cash_retained_cents` bigint,
	`portfolio_impact` json,
	`opportunity_cost` json,
	`created_at` bigint NOT NULL,
	CONSTRAINT `aperture_strategies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `asset_share_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`asset_id` int NOT NULL,
	`expires_at` bigint NOT NULL,
	`view_count` int NOT NULL DEFAULT 0,
	`created_at` bigint NOT NULL,
	CONSTRAINT `asset_share_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `asset_share_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `broker_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` int NOT NULL,
	`candidate_id` int,
	`account_id` int NOT NULL,
	`user_id` int NOT NULL,
	`symbol` varchar(24) NOT NULL,
	`side` enum('buy','sell') NOT NULL,
	`qty` float,
	`notional_cents` bigint,
	`order_type` enum('market','limit') NOT NULL DEFAULT 'market',
	`limit_price_cents` bigint,
	`time_in_force` enum('day','gtc') NOT NULL DEFAULT 'day',
	`status` enum('pending_approval','approved','submitted','filled','rejected','cancelled') NOT NULL DEFAULT 'pending_approval',
	`broker_order_id` varchar(128),
	`filled_qty` float,
	`filled_avg_price_cents` bigint,
	`rejection_reason` text,
	`approved_at` bigint,
	`submitted_at` bigint,
	`filled_at` bigint,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `broker_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `capital_theses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(160),
	`raw_text` text NOT NULL,
	`graph` json,
	`confidence_notes` json DEFAULT ('[]'),
	`status` enum('compiling','review','active','archived') NOT NULL DEFAULT 'compiling',
	`is_primary` boolean NOT NULL DEFAULT false,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `capital_theses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exposure_coverage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` int NOT NULL,
	`node_id` int NOT NULL,
	`symbol` varchar(24) NOT NULL,
	`weight_pct` float,
	`source` enum('holding','intended','candidate') NOT NULL,
	CONSTRAINT `exposure_coverage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exposure_nodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`thesis_id` int NOT NULL,
	`parent_id` int,
	`label` varchar(160) NOT NULL,
	`depth` int NOT NULL DEFAULT 0,
	`path` varchar(512),
	`created_at` bigint NOT NULL,
	CONSTRAINT `exposure_nodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monitoring_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` int NOT NULL,
	`candidate_id` int NOT NULL,
	`symbol` varchar(24) NOT NULL,
	`check_type` enum('catalyst','thesis_invalidation','earnings','macro') NOT NULL,
	`finding` text,
	`flagged` boolean NOT NULL DEFAULT false,
	`citations` json DEFAULT ('[]'),
	`checked_at` bigint NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `monitoring_checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolio_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`label` varchar(120) NOT NULL,
	`broker_id` varchar(32) NOT NULL DEFAULT 'manual',
	`external_account_id` varchar(128),
	`is_paper` boolean NOT NULL DEFAULT true,
	`cash_cents` bigint,
	`buying_power_cents` bigint,
	`equity_value_cents` bigint,
	`last_synced_at` bigint,
	`sync_source` varchar(64),
	`sync_error` text,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `portfolio_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `position_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`run_id` int,
	`symbol` varchar(24) NOT NULL,
	`qty` float NOT NULL,
	`avg_cost_cents` bigint,
	`last_price_cents` bigint,
	`market_value_cents` bigint,
	`unrealized_pnl_cents` bigint,
	`price_basis` enum('verified','modeled') NOT NULL DEFAULT 'modeled',
	`snapshot_at` bigint NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `position_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `positions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`symbol` varchar(24) NOT NULL,
	`asset_type` enum('equity','etf','option','crypto','cash') NOT NULL DEFAULT 'equity',
	`qty` float NOT NULL,
	`avg_cost_cents` bigint,
	`last_price_cents` bigint,
	`market_value_cents` bigint,
	`price_as_of` bigint,
	`price_source` varchar(64),
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `positions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `securities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(24) NOT NULL,
	`name` varchar(255),
	`exchange` varchar(32),
	`sector` varchar(96),
	`industry` varchar(128),
	`cik` varchar(16),
	`asset_type` enum('equity','etf','option','crypto') NOT NULL DEFAULT 'equity',
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `securities_id` PRIMARY KEY(`id`),
	CONSTRAINT `securities_symbol_unique` UNIQUE(`symbol`)
);
--> statement-breakpoint
CREATE TABLE `security_facts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(24) NOT NULL,
	`fact_key` varchar(80) NOT NULL,
	`value_num` float,
	`value_text` text,
	`unit` varchar(24),
	`basis` enum('verified','modeled','unknown') NOT NULL,
	`assumption` text,
	`provider_id` varchar(32) NOT NULL,
	`source_name` varchar(160),
	`source_url` text,
	`as_of` bigint,
	`fetched_at` bigint NOT NULL,
	`expires_at` bigint,
	CONSTRAINT `security_facts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sourcing_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schedule_id` int,
	`asset_class` varchar(64) NOT NULL,
	`trigger` varchar(16) NOT NULL DEFAULT 'schedule',
	`created_count` int NOT NULL DEFAULT 0,
	`researched_count` int NOT NULL DEFAULT 0,
	`markets` json,
	`message` text,
	`error` text,
	`ran_at` bigint NOT NULL,
	`duration_ms` int,
	CONSTRAINT `sourcing_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sourcing_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`asset_class` varchar(64) NOT NULL DEFAULT 'historic',
	`enabled` boolean NOT NULL DEFAULT false,
	`cadence` varchar(16) NOT NULL DEFAULT 'daily',
	`hour_utc` int NOT NULL DEFAULT 9,
	`nationwide` boolean NOT NULL DEFAULT false,
	`markets_per_run` int NOT NULL DEFAULT 5,
	`limit_per_run` int NOT NULL DEFAULT 10,
	`last_run_at` bigint,
	`last_run_created` int,
	`last_run_message` text,
	`next_run_at` bigint,
	`created_by_user_id` int,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `sourcing_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `thesis_variants` (
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
--> statement-breakpoint
ALTER TABLE `investor_interest` MODIFY COLUMN `deal_id` int;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `is_off_market` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `off_market_signals` json;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `motivation_score` int;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `assigned_user_id` int;--> statement-breakpoint
ALTER TABLE `commercial_assets` ADD `assignment_note` text;--> statement-breakpoint
ALTER TABLE `investor_interest` ADD `asset_id` int;--> statement-breakpoint
ALTER TABLE `users` ADD `merged_into_user_id` int;