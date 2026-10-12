-- PD-06: owner-confirmed SEC attachment versions and immutable Red Team runs.
-- No changes to legacy deals/decisions; no automatic entity matches or FKs.
CREATE TABLE deal_evidence_attachments (
 id VARCHAR(36) PRIMARY KEY, owner_id INT NOT NULL, deal_id INT NOT NULL,
 request_id VARCHAR(36) NOT NULL, receipt_id VARCHAR(36) NOT NULL,
 payload_hash VARCHAR(64) NOT NULL, confirmed_cik VARCHAR(10) NOT NULL,
 relation ENUM('same_legal_entity') NOT NULL, identity_basis VARCHAR(64) NOT NULL,
 created_at DATETIME(3) NOT NULL,
 UNIQUE KEY deal_evidence_attachment_request_uq (owner_id, request_id),
 KEY deal_evidence_attachment_deal_idx (owner_id, deal_id, created_at, id)
) ENGINE=InnoDB;
CREATE TABLE deal_evidence_analysis_requests (
 id VARCHAR(36) PRIMARY KEY, owner_id INT NOT NULL, deal_id INT NOT NULL,
 request_id VARCHAR(36) NOT NULL, request_hash VARCHAR(64) NOT NULL,
 mode ENUM('red_team','ic') NOT NULL, models JSON NOT NULL,
 input_snapshot JSON NOT NULL, started_at DATETIME(3) NOT NULL,
 UNIQUE KEY deal_evidence_analysis_request_uq (owner_id, request_id),
 KEY deal_evidence_analysis_deal_idx (owner_id, deal_id, started_at, id)
) ENGINE=InnoDB;
CREATE TABLE deal_evidence_analysis_results (
 id VARCHAR(36) PRIMARY KEY, owner_id INT NOT NULL, deal_id INT NOT NULL,
 status ENUM('complete','failed') NOT NULL, output JSON NULL,
 failure_code VARCHAR(64) NULL, message VARCHAR(1000) NULL, completed_at DATETIME(3) NOT NULL
) ENGINE=InnoDB;
