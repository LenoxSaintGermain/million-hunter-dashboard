CREATE TABLE `aperture_play_decisions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `run_id` int NOT NULL,
  `candidate_id` int NOT NULL,
  `decision` enum('skipped','deferred') NOT NULL,
  `reason` text NOT NULL,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  CONSTRAINT `aperture_play_decisions_id` PRIMARY KEY(`id`),
  CONSTRAINT `aperture_play_decision_scope` UNIQUE(`user_id`,`run_id`,`candidate_id`)
);
--> statement-breakpoint
CREATE INDEX `aperture_play_decision_run_idx` ON `aperture_play_decisions` (`run_id`);
