CREATE TABLE `research_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subject_key` varchar(256) NOT NULL,
	`subject_type` enum('deal','radar_signal','industry','market') NOT NULL,
	`model` varchar(64) NOT NULL,
	`query` text NOT NULL,
	`content` text NOT NULL,
	`citations` json NOT NULL,
	`search_results` json,
	`num_search_queries` int,
	`cost_usd` float,
	`created_at` bigint NOT NULL,
	`expires_at` bigint NOT NULL,
	CONSTRAINT `research_results_id` PRIMARY KEY(`id`)
);
