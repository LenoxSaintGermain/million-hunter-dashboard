-- Service-level ledger only. No data backfill, verified-gain producer, or order writes.
CREATE TABLE `aperture_capital_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `account_id` int NOT NULL,
  `account_label` varchar(120) NOT NULL,
  `broker_id` varchar(32) NOT NULL,
  `external_account_id` varchar(128),
  `source_id` varchar(160) NOT NULL,
  `source_key` varchar(160) NOT NULL,
  `capital_event_id` varchar(160) NOT NULL,
  `source_kind` enum('operator_declared_excess','reconciled_available_funds','realized_gains','returned_principal','hypothetical_future_proceeds') NOT NULL,
  `currency` enum('USD') NOT NULL,
  `amount_cents` bigint,
  `proof_basis` enum('operator_declared','unknown') NOT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `capital_event_owner_source_key_uq` (`user_id`,`source_key`),
  UNIQUE KEY `capital_event_owner_source_uq` (`user_id`,`source_id`),
  UNIQUE KEY `capital_event_owner_event_uq` (`user_id`,`capital_event_id`),
  KEY `capital_event_owner_account_idx` (`user_id`,`account_id`,`id`)
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE `aperture_capital_claims` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `account_id` int NOT NULL,
  `event_id` int NOT NULL,
  `allocation_id` varchar(160) NOT NULL,
  `amount_cents` bigint NOT NULL,
  `state` enum('pending','committed','consumed','released') NOT NULL,
  `previous_state` enum('pending','committed'),
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `capital_claim_owner_allocation_uq` (`user_id`,`allocation_id`),
  KEY `capital_claim_event_idx` (`event_id`,`id`)
) ENGINE=InnoDB;
