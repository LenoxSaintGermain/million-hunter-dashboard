CREATE TABLE `agent_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deal_id` int NOT NULL,
	`agent_type` enum('deal_architect','red_team','remediation') NOT NULL,
	`status` enum('pending','running','complete','failed') NOT NULL DEFAULT 'pending',
	`input_context` json,
	`artifacts` json,
	`findings` json,
	`remediations` json,
	`raw_response` text,
	`confidence_score` float,
	`tokens_used` int,
	`parent_run_id` int,
	`created_at` bigint NOT NULL,
	`completed_at` bigint,
	CONSTRAINT `agent_runs_id` PRIMARY KEY(`id`)
);
