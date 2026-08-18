ALTER TABLE `aperture_play_decisions` ADD COLUMN `resume_at` bigint;
--> statement-breakpoint
CREATE INDEX `aperture_play_decision_resume_idx` ON `aperture_play_decisions` (`resume_at`);
