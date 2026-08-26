-- TSL-BUILD-2026-008 Decision Runway: additive durable operator context only.
-- No backfill. Existing runs and broker tables remain unchanged.
CREATE TABLE IF NOT EXISTS `aperture_runway_states` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `canonical_thesis_id` INT NULL,
  `account_id` INT NULL,
  `run_id` INT NULL,
  `mission_text` TEXT NOT NULL,
  `mission_hash` VARCHAR(64) NOT NULL,
  `branch` ENUM('research','eligible','conditional','cash') NOT NULL DEFAULT 'research',
  `reason` TEXT NULL,
  `selected_at` BIGINT NOT NULL,
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `aperture_runway_state_run_unique` (`run_id`),
  KEY `aperture_runway_state_user_updated_idx` (`user_id`, `updated_at`)
);
