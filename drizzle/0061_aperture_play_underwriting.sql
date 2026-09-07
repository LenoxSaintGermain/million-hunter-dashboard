-- Play Underwriter: immutable strategy-generation revisions upstream of research.
-- Additive only. Existing Decision Run, research, proposal, approval, and submission
-- rows retain their authority and are not backfilled with invented underwriting.

ALTER TABLE `aperture_decision_revisions`
  ADD COLUMN `target_profit_cents` BIGINT NULL AFTER `desired_ending_value_cents`,
  ADD COLUMN `target_period` ENUM('session','week','month') NULL AFTER `target_profit_cents`,
  ADD COLUMN `holding_periods` JSON NULL AFTER `holding_period`;

CREATE TABLE IF NOT EXISTS `aperture_underwriting_runs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `decision_run_id` INT NOT NULL,
  `current_revision_id` INT NULL,
  `selected_play_id` VARCHAR(96) NULL,
  `selected_at` BIGINT NULL,
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `aperture_underwriting_runs_decision_uq` (`decision_run_id`),
  KEY `aperture_underwriting_runs_owner_updated_idx` (`user_id`, `updated_at`)
);

CREATE TABLE IF NOT EXISTS `aperture_underwriting_revisions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `underwriting_run_id` INT NOT NULL,
  `decision_revision_id` INT NOT NULL,
  `version` INT NOT NULL,
  `previous_revision_id` INT NULL,
  `objective` JSON NOT NULL,
  `feasibility` JSON NOT NULL,
  `market_snapshot` JSON NOT NULL,
  `tactical_theses` JSON NOT NULL,
  `plays` JSON NOT NULL,
  `no_trade` JSON NULL,
  `portfolio_risk` JSON NOT NULL,
  `provider_availability` JSON NULL,
  `created_by_user_id` INT NOT NULL,
  `created_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `aperture_underwriting_revisions_version_uq` (`underwriting_run_id`, `version`),
  KEY `aperture_underwriting_revisions_decision_idx` (`decision_revision_id`, `created_at`)
);
