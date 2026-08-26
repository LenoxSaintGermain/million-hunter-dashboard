-- Decision Runway corrective authority model.
-- Additive only: the 0054 runway rows remain legacy evidence and are not
-- backfilled into an audit history that did not exist.

CREATE TABLE IF NOT EXISTS `aperture_decision_runs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `canonical_thesis_id` INT NOT NULL,
  `capital_thesis_id` INT NOT NULL,
  `account_id` INT NOT NULL,
  `research_run_id` INT NULL,
  `current_revision_id` INT NULL,
  `lifecycle` ENUM('mission','researching','conditional','eligible','cash','pending_outcome','closed') NOT NULL DEFAULT 'mission',
  `lock_version` INT NOT NULL DEFAULT 0,
  `closed_at` BIGINT NULL,
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `aperture_decision_runs_research_run_uq` (`research_run_id`),
  KEY `aperture_decision_runs_owner_updated_idx` (`user_id`, `updated_at`)
);

CREATE TABLE IF NOT EXISTS `aperture_decision_revisions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `decision_run_id` INT NOT NULL,
  `version` INT NOT NULL,
  `previous_revision_id` INT NULL,
  `mission_text` TEXT NOT NULL,
  `mission_hash` VARCHAR(64) NOT NULL,
  `mission_source` ENUM('assigned','inline','library','edited') NOT NULL DEFAULT 'assigned',
  `objective` ENUM('best_qualified_play','deploy_today','verify_catalyst','portfolio_gap','preserve_optionality') NOT NULL DEFAULT 'best_qualified_play',
  `instrument_preference` ENUM('shares','options','either') NOT NULL DEFAULT 'either',
  `include_held_research` BOOLEAN NOT NULL DEFAULT FALSE,
  `deployable_capital_cents` BIGINT NOT NULL,
  `desired_ending_value_cents` BIGINT NULL,
  `max_planned_loss_cents` BIGINT NOT NULL,
  `holding_period` ENUM('intraday','overnight','swing','catalyst_window') NOT NULL,
  `invalidation_rule` TEXT NOT NULL,
  `operator_choice` ENUM('research','conditional','cash','selected_play') NOT NULL DEFAULT 'research',
  `effective_branch` ENUM('research','eligible','conditional','cash') NOT NULL DEFAULT 'research',
  `selected_candidate_id` INT NULL,
  `planned_risk_cents` BIGINT NOT NULL DEFAULT 0,
  `reason` TEXT NULL,
  `blocker` TEXT NULL,
  `reopen_condition` TEXT NULL,
  `review_at` BIGINT NULL,
  `named_gate_key` VARCHAR(96) NULL,
  `named_gate_label` VARCHAR(240) NULL,
  `context_snapshot` JSON NULL,
  `gate_snapshot` JSON NULL,
  `ranking_snapshot` JSON NULL,
  `created_by_user_id` INT NOT NULL,
  `created_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `aperture_decision_revisions_version_uq` (`decision_run_id`, `version`),
  KEY `aperture_decision_revisions_decision_created_idx` (`decision_run_id`, `created_at`)
);

CREATE TABLE IF NOT EXISTS `aperture_pending_outcomes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `decision_run_id` INT NOT NULL,
  `revision_id` INT NOT NULL,
  `order_id` INT NULL,
  `kind` ENUM('gate_review','play_outcome') NOT NULL,
  `status` ENUM('pending','due','resolved','cancelled') NOT NULL DEFAULT 'pending',
  `due_at` BIGINT NOT NULL,
  `gate_key` VARCHAR(96) NULL,
  `review_basis` TEXT NOT NULL,
  `result` JSON NULL,
  `resolved_at` BIGINT NULL,
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `aperture_pending_outcomes_order_kind_uq` (`order_id`, `kind`),
  KEY `aperture_pending_outcomes_owner_due_idx` (`user_id`, `status`, `due_at`)
);

ALTER TABLE `broker_orders`
  ADD COLUMN `decision_run_id` INT NULL AFTER `user_id`,
  ADD COLUMN `decision_revision_id` INT NULL AFTER `decision_run_id`,
  ADD COLUMN `client_order_id` VARCHAR(64) NULL AFTER `broker_order_id`,
  ADD COLUMN `dispatch_error` TEXT NULL AFTER `client_order_id`,
  ADD KEY `broker_orders_decision_run_idx` (`decision_run_id`, `decision_revision_id`),
  ADD UNIQUE KEY `broker_orders_client_order_uq` (`client_order_id`);
