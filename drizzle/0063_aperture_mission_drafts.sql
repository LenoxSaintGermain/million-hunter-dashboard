-- Incomplete drafts have no research, proposal, approval, or broker authority.
-- Owner-head CAS and its append-only revision are committed in one transaction.
CREATE TABLE IF NOT EXISTS `aperture_mission_drafts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `version` INT NOT NULL,
  `draft_values` JSON NOT NULL,
  `completed_at` BIGINT NULL,
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `aperture_mission_drafts_owner_uq` (`user_id`)
);

CREATE TABLE IF NOT EXISTS `aperture_mission_draft_revisions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `draft_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `version` INT NOT NULL,
  `draft_values` JSON NOT NULL,
  `completed_at` BIGINT NULL,
  `created_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `aperture_mission_draft_revision_uq` (`draft_id`, `version`),
  KEY `aperture_mission_draft_revision_owner_idx` (`user_id`, `created_at`)
);
