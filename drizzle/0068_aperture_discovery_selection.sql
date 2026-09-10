-- Source-bound tactical research context. Existing receipts and broker records
-- are not backfilled, reclassified or modified.
ALTER TABLE aperture_decision_runs
  MODIFY context_kind ENUM('thesis', 'objective', 'discovery') NOT NULL DEFAULT 'thesis';
--> statement-breakpoint
CREATE TABLE aperture_discovery_selections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  source_decision_run_id INT NOT NULL,
  source_revision_id INT NOT NULL,
  discovery_receipt_id INT NOT NULL,
  hypothesis_id VARCHAR(160) NOT NULL,
  research_decision_run_id INT NOT NULL,
  research_revision_id INT NOT NULL,
  capital_thesis_id INT NOT NULL,
  source_record_hash VARCHAR(64) NOT NULL,
  context JSON NOT NULL,
  record_hash VARCHAR(64) NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE KEY aperture_selection_source_hypothesis_uq (user_id, discovery_receipt_id, hypothesis_id),
  UNIQUE KEY aperture_selection_research_decision_uq (research_decision_run_id),
  UNIQUE KEY aperture_selection_projection_uq (capital_thesis_id),
  KEY aperture_selection_owner_source_idx (user_id, source_decision_run_id, source_revision_id)
);
