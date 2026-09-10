-- Evidence snapshots only. No existing order, balance or gain is altered.
CREATE TABLE aperture_execution_evidence (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL, account_id INT NOT NULL, run_id INT NOT NULL,
  candidate_id INT NOT NULL, order_id INT NOT NULL,
  request_id VARCHAR(36) NOT NULL,
  external_account_id VARCHAR(128) NOT NULL, broker_order_id VARCHAR(128) NOT NULL,
  state ENUM('pending','complete','failed') NOT NULL,
  receipt JSON, record_hash VARCHAR(64), failure_code VARCHAR(64),
  created_at BIGINT NOT NULL, completed_at BIGINT,
  UNIQUE KEY execution_evidence_owner_request_uq (user_id, request_id),
  KEY execution_evidence_owner_order_idx (user_id, order_id, id)
);
