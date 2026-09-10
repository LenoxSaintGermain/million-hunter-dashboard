-- Additive compatibility migration. Existing receipts retain their identities.
-- Apply only through the reviewed release procedure, never from a UAT runner.
ALTER TABLE aperture_decision_runs
  ADD COLUMN context_kind ENUM('thesis', 'objective') NOT NULL DEFAULT 'thesis',
  ADD COLUMN client_request_id VARCHAR(36) NULL,
  MODIFY COLUMN canonical_thesis_id INT NULL,
  MODIFY COLUMN capital_thesis_id INT NULL,
  ADD UNIQUE KEY aperture_decision_runs_owner_request_uq (user_id, client_request_id);

-- An accepted capital question is not yet a tactical thesis with invalidation.
-- Existing thesis/research entry points still require a substantive rule.
ALTER TABLE aperture_decision_revisions MODIFY COLUMN invalidation_rule TEXT NULL;
