CREATE TABLE IF NOT EXISTS `aperture_evidence_reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `run_id` int NOT NULL,
  `candidate_id` int NOT NULL,
  `check_label` varchar(255) NOT NULL,
  `status` enum('reviewed','needs_follow_up') NOT NULL DEFAULT 'reviewed',
  `note` text,
  `reviewed_at` bigint NOT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `aperture_evidence_review_scope` (`user_id`,`run_id`,`candidate_id`,`check_label`)
);
