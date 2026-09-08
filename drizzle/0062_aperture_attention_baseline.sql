-- Owner-scoped comparison baseline for the Today briefing.
-- This records only what was displayed; it does not acknowledge or resolve any
-- evidence, decision, proposal, order, monitoring finding, or outcome.

CREATE TABLE IF NOT EXISTS `aperture_attention_baselines` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `snapshot` JSON NOT NULL,
  `token` VARCHAR(64) NOT NULL,
  `captured_at` BIGINT NOT NULL,
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `aperture_attention_baselines_owner_uq` (`user_id`)
);
