CREATE TABLE `invite_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`assign_role` enum('user','admin','investor','insurance') NOT NULL,
	`label` varchar(256),
	`recipient_email` varchar(256),
	`created_by_user_id` int NOT NULL,
	`expires_at` timestamp,
	`consumed_at` timestamp,
	`consumed_by_user_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invite_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `invite_tokens_token_unique` UNIQUE(`token`)
);
