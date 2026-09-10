-- Immutable evidence receipts; reuse aperture_underwriting_jobs for work/leases.
-- No capital, order, approval or submission changes.
CREATE TABLE aperture_strategy_discoveries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  decision_run_id INT NOT NULL,
  decision_revision_id INT NOT NULL,
  job_id INT NOT NULL,
  attempt INT NOT NULL,
  attempt_token VARCHAR(36) NOT NULL,
  request JSON NOT NULL,
  payload JSON NOT NULL,
  manifest JSON NOT NULL,
  result JSON NOT NULL,
  record_hash VARCHAR(64) NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE KEY aperture_discovery_job_attempt_uq (job_id, attempt),
  KEY aperture_discovery_owner_revision_idx (user_id, decision_revision_id, id)
);
