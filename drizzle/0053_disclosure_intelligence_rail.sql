-- WP-DIR1 Disclosure Intelligence Rail. Append-only provenance records only.
CREATE TABLE disclosure_plans (
  id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
  status ENUM('draft','review','monitoring','paused','archived') NOT NULL DEFAULT 'draft',
  current_revision_id INT NULL, approved_at BIGINT NULL, paused_at BIGINT NULL, archived_at BIGINT NULL,
  created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL,
  INDEX disclosure_plans_owner_status_idx (user_id, status)
);
CREATE TABLE disclosure_plan_revisions (
  id INT AUTO_INCREMENT PRIMARY KEY, plan_id INT NOT NULL, revision_number INT NOT NULL,
  raw_intent TEXT NOT NULL, compiled_plan JSON NOT NULL, compiler_role VARCHAR(96) NOT NULL,
  prompt_version VARCHAR(64) NOT NULL, confidence_notes JSON NULL, operator_resolutions JSON NULL,
  content_hash VARCHAR(64) NOT NULL, compiled_at BIGINT NOT NULL, created_at BIGINT NOT NULL,
  UNIQUE KEY disclosure_plan_revision_unique (plan_id, revision_number),
  INDEX disclosure_plan_revision_hash_idx (content_hash)
);
CREATE TABLE disclosure_filings (
  id INT AUTO_INCREMENT PRIMARY KEY, source ENUM('house_clerk') NOT NULL,
  stable_source_document_id VARCHAR(128) NOT NULL, canonical_url TEXT NOT NULL,
  filer_id VARCHAR(160) NOT NULL, filer_name VARCHAR(255) NOT NULL, chamber ENUM('house') NOT NULL,
  filed_at BIGINT NULL, first_observed_at BIGINT NOT NULL, retrieved_at BIGINT NOT NULL,
  storage_key VARCHAR(512) NOT NULL, content_hash VARCHAR(64) NOT NULL, media_type VARCHAR(128) NOT NULL,
  byte_size BIGINT NOT NULL, parser_version VARCHAR(96) NOT NULL, supersedes_filing_id INT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE KEY disclosure_filing_source_hash_unique (source, stable_source_document_id, content_hash),
  INDEX disclosure_filing_source_id_idx (source, stable_source_document_id)
);
CREATE TABLE disclosure_retrievals (
  id INT AUTO_INCREMENT PRIMARY KEY, filing_id INT NULL, source ENUM('house_clerk') NOT NULL,
  stable_source_document_id VARCHAR(128) NOT NULL, retrieved_at BIGINT NOT NULL,
  observed_hash VARCHAR(64) NULL, result ENUM('stored','repeat','source_changed','failed') NOT NULL,
  transport_metadata JSON NULL, error TEXT NULL, created_at BIGINT NOT NULL,
  INDEX disclosure_retrieval_source_id_idx (source, stable_source_document_id)
);
CREATE TABLE disclosure_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY, filing_id INT NOT NULL, source_row_identity VARCHAR(255) NOT NULL,
  owner_as_stated ENUM('self','spouse','dependent','unknown') NOT NULL,
  raw_asset_name TEXT NOT NULL, raw_asset_description TEXT NULL,
  transaction_type ENUM('purchase','sale','exchange','unknown') NOT NULL,
  transaction_date BIGINT NULL, amount_min_usd BIGINT NULL, amount_max_usd BIGINT NULL,
  asset_type_as_stated VARCHAR(64) NULL, security_id INT NULL, normalized_issuer VARCHAR(255) NULL,
  resolution_grade ENUM('exact','strong','ambiguous','none') NOT NULL DEFAULT 'none', resolution_basis JSON NULL,
  publication_basis ENUM('source_timestamp','first_observed') NULL, eligible_from BIGINT NULL,
  disclosure_lag_days INT NULL, created_at BIGINT NOT NULL,
  UNIQUE KEY disclosure_transaction_filing_row_unique (filing_id, source_row_identity),
  INDEX disclosure_transaction_filing_idx (filing_id)
);
CREATE TABLE disclosure_matches (
  id INT AUTO_INCREMENT PRIMARY KEY, plan_revision_id INT NOT NULL, transaction_id INT NOT NULL,
  gate_snapshot JSON NOT NULL, disclosure_mandate_version VARCHAR(32) NOT NULL, effective_controls JSON NOT NULL,
  state ENUM('held','reviewable','promoted','set_aside') NOT NULL, reasons JSON NULL,
  reviewed_by_user_id INT NULL, reviewed_at BIGINT NULL, review_note TEXT NULL,
  thesis_id INT NULL, run_id INT NULL, candidate_id INT NULL, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL,
  UNIQUE KEY disclosure_match_plan_transaction_unique (plan_revision_id, transaction_id),
  INDEX disclosure_match_state_idx (state)
);
CREATE TABLE disclosure_entity_aliases (
  id INT AUTO_INCREMENT PRIMARY KEY, raw_asset_text TEXT NOT NULL, raw_asset_hash VARCHAR(64) NOT NULL,
  security_id INT NOT NULL, status ENUM('active','revoked') NOT NULL DEFAULT 'active', basis TEXT NOT NULL,
  created_by_user_id INT NOT NULL, created_at BIGINT NOT NULL,
  revoked_by_user_id INT NULL, revoked_at BIGINT NULL,
  INDEX disclosure_alias_raw_hash_idx (raw_asset_hash, status)
);
