CREATE TABLE `investor_dna` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`time_horizon` float NOT NULL DEFAULT 0.5,
	`risk_tolerance` float NOT NULL DEFAULT 0.5,
	`liquidity_need` float NOT NULL DEFAULT 0.5,
	`esg_conviction` float NOT NULL DEFAULT 0.5,
	`sector_affinity` json DEFAULT ('[]'),
	`archetype_code` varchar(32),
	`archetype_label` varchar(128),
	`quiz_completed` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `investor_dna_id` PRIMARY KEY(`id`),
	CONSTRAINT `investor_dna_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `investor_interest` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`deal_id` int NOT NULL,
	`allocation_amount` bigint,
	`status` enum('expressed','operator_reviewing','memo_shared','committed','passed') NOT NULL DEFAULT 'expressed',
	`investor_note` text,
	`operator_note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `investor_interest_id` PRIMARY KEY(`id`)
);
