CREATE TABLE `insurance_prospects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deal_id` int NOT NULL,
	`prospect_score` float,
	`estimated_premium_low` bigint,
	`estimated_premium_high` bigint,
	`risk_profile` enum('low','moderate','elevated','high') NOT NULL DEFAULT 'moderate',
	`policy_fit` json DEFAULT ('[]'),
	`brief_text` text,
	`status` enum('new','briefed','contacted','quoted','closed','passed') NOT NULL DEFAULT 'new',
	`generated_by_user_id` int,
	`scored_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `insurance_prospects_id` PRIMARY KEY(`id`),
	CONSTRAINT `insurance_prospects_deal_id_unique` UNIQUE(`deal_id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','investor','insurance') NOT NULL DEFAULT 'user';