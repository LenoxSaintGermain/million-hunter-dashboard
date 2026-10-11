-- Additive personal SEC research storage. No implicit deal binding or users FK.
-- Application receipts are append-only. Quota rows alone are mutable.
CREATE TABLE public_evidence_receipts (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  owner_id INT NOT NULL,
  subject_key VARCHAR(17) NOT NULL,
  request_id VARCHAR(36) NOT NULL,
  provider ENUM('sec-submissions') NOT NULL,
  schema_version INT NOT NULL,
  source_url VARCHAR(512) NOT NULL,
  status ENUM('ok', 'empty', 'unavailable') NOT NULL,
  payload JSON NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,
  recorded_at DATETIME(3) NOT NULL,
  retrieved_at DATETIME(3) NULL,
  expires_at DATETIME(3) NULL,
  message TEXT NULL,
  failure_code VARCHAR(64) NULL,
  UNIQUE KEY public_evidence_owner_request_uq (owner_id, request_id),
  KEY public_evidence_owner_subject_time_idx (owner_id, subject_key, recorded_at, id)
) ENGINE=InnoDB;

-- Stable keys: sec-submissions:global and sec-submissions:owner:<ownerId>.
-- Atomic rollover reuses rows. Growth is bounded by distinct owners, not time.
CREATE TABLE public_evidence_budgets (
  budget_key VARCHAR(64) NOT NULL PRIMARY KEY,
  window_start BIGINT NOT NULL,
  request_count INT NOT NULL,
  second_start BIGINT NOT NULL,
  second_count INT NOT NULL,
  cooldown_until BIGINT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- One durable claim per owner/request, independent of provider success/failure.
-- Only its winning insert permits execution. It is never renewed or reclaimed.
CREATE TABLE public_evidence_capture_claims (
  owner_id INT NOT NULL,
  request_id VARCHAR(36) NOT NULL,
  subject_key VARCHAR(17) NOT NULL,
  started_at DATETIME(3) NOT NULL,
  PRIMARY KEY (owner_id, request_id)
) ENGINE=InnoDB;
