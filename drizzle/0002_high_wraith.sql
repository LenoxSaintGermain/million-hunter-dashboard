CREATE TABLE `commercial_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` varchar(500) NOT NULL,
	`city` varchar(100) NOT NULL,
	`state` varchar(50) NOT NULL,
	`zip` varchar(20),
	`property_type` enum('office','industrial','retail','mixed_use','land','warehouse','flex') NOT NULL DEFAULT 'retail',
	`square_footage` int,
	`asking_price` bigint,
	`cap_rate` float,
	`noi` bigint,
	`lease_type` enum('nnn','gross','modified_gross','vacant'),
	`zoning` varchar(100),
	`opportunity_zone` boolean NOT NULL DEFAULT false,
	`oz_tract_id` varchar(20),
	`tad_district` varchar(100),
	`distance_to_venue` float,
	`event_revenue_low` int,
	`event_revenue_high` int,
	`source` varchar(100) NOT NULL DEFAULT 'manual',
	`source_url` text,
	`ai_score` float,
	`ai_analysis` text,
	`status` enum('new','reviewing','qualified','rejected','acquired') NOT NULL DEFAULT 'new',
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `commercial_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consensus_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dealId` int NOT NULL,
	`model1Name` varchar(128),
	`model1Score` float,
	`model1Rationale` text,
	`model2Name` varchar(128),
	`model2Score` float,
	`model2Rationale` text,
	`model3Name` varchar(128),
	`model3Score` float,
	`model3Rationale` text,
	`consensusScore` float,
	`divergenceScore` float,
	`divergenceFlag` boolean DEFAULT false,
	`summary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `consensus_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deal_share_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`deal_id` int NOT NULL,
	`expires_at` bigint,
	`view_count` int NOT NULL DEFAULT 0,
	`created_at` bigint NOT NULL,
	CONSTRAINT `deal_share_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `deal_share_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `deal_trajectory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dealId` int NOT NULL,
	`agentName` varchar(128) NOT NULL,
	`model` varchar(128) NOT NULL,
	`inputSummary` text,
	`outputSummary` text,
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deal_trajectory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `freedom_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` varchar(64),
	`name` varchar(128) NOT NULL DEFAULT 'My Freedom Plan',
	`targetMonthlyIncome` bigint NOT NULL,
	`currentIncome` bigint,
	`investmentCapital` bigint,
	`timelineYears` int NOT NULL DEFAULT 3,
	`riskTolerance` enum('conservative','moderate','aggressive') NOT NULL DEFAULT 'moderate',
	`location` varchar(256),
	`situation` enum('single','married','family') NOT NULL DEFAULT 'single',
	`age` int,
	`aiRationale` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `freedom_goals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `investor_dossiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dealId` int,
	`blueprintId` int,
	`userId` varchar(64),
	`title` varchar(256) NOT NULL,
	`investorPersona` enum('passive','active','institutional','family_office','syndicate') NOT NULL DEFAULT 'passive',
	`thesis` text,
	`analystCommentary` text,
	`skepticCommentary` text,
	`visionaryCommentary` text,
	`financialProjections` json,
	`riskAssessment` json,
	`capitalStack` json,
	`keyHighlights` json,
	`recommendation` enum('STRONG_BUY','BUY','CONSIDER','PASS') NOT NULL DEFAULT 'CONSIDER',
	`pdfUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `investor_dossiers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `macro_signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`signal_type` enum('institutional','government','seasonal','event','macro_momentum') NOT NULL,
	`title` varchar(255) NOT NULL,
	`summary` text NOT NULL,
	`rory_pitch` text,
	`impacted_asset_classes` json,
	`recommended_action` text,
	`confidence_score` float,
	`source_url` text,
	`expires_at` bigint,
	`archived` boolean NOT NULL DEFAULT false,
	`created_at` bigint NOT NULL,
	CONSTRAINT `macro_signals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`module` varchar(64) NOT NULL,
	`modelId` varchar(128) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `model_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `model_config_module_unique` UNIQUE(`module`)
);
--> statement-breakpoint
CREATE TABLE `opportunity_radar` (
	`id` int AUTO_INCREMENT NOT NULL,
	`signalType` enum('permit_filed','tad_boundary','zoning_change','world_event','land_play','gas_station_hold','parking_arbitrage','lot_prep','microloan','other') NOT NULL,
	`title` varchar(256) NOT NULL,
	`location` varchar(256),
	`description` text,
	`urgencyScore` float,
	`estimatedROI` float,
	`estimatedHoldYears` float,
	`capitalRequired` bigint,
	`aiAnalysis` text,
	`sourceUrl` text,
	`expiresAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `opportunity_radar_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seller_simulations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dealId` int NOT NULL,
	`personaJson` json,
	`scenariosJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seller_simulations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `strategy_blueprints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`goalId` int,
	`userId` varchar(64),
	`name` varchar(256) NOT NULL,
	`recipe` json NOT NULL,
	`capitalStack` json,
	`projectedMonthlyIncome` bigint,
	`projectedTotalInvestment` bigint,
	`dscr` float,
	`scenario` enum('conservative','base','aggressive') NOT NULL DEFAULT 'base',
	`aiRationale` text,
	`isFavorite` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `strategy_blueprints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `outreach` MODIFY COLUMN `status` enum('pending','sent','opened','replied','meeting_scheduled','no_response','not_interested','closed') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `deals` ADD `opportunity_zone` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `deals` ADD `oz_tract_id` varchar(32);--> statement-breakpoint
ALTER TABLE `deals` ADD `tad_district` varchar(128);--> statement-breakpoint
ALTER TABLE `deals` ADD `oz_potential_gain` bigint;--> statement-breakpoint
ALTER TABLE `deals` ADD `event_proximity_miles` float;--> statement-breakpoint
ALTER TABLE `deals` ADD `event_revenue_low` bigint;--> statement-breakpoint
ALTER TABLE `deals` ADD `event_revenue_high` bigint;--> statement-breakpoint
ALTER TABLE `outreach` ADD `channel` enum('email','phone','linkedin','sms') DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE `outreach` ADD `subject` text;--> statement-breakpoint
ALTER TABLE `outreach` ADD `body` text;--> statement-breakpoint
ALTER TABLE `scan_jobs` ADD `currentPhase` varchar(128);--> statement-breakpoint
ALTER TABLE `scan_jobs` ADD `phaseDetail` varchar(512);--> statement-breakpoint
ALTER TABLE `scan_jobs` ADD `progressPct` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `scan_jobs` ADD `dealsScored` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `onboarding_completed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `outreach` DROP COLUMN `emailSubject`;--> statement-breakpoint
ALTER TABLE `outreach` DROP COLUMN `emailBody`;