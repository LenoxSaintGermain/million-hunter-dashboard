-- Destructive rollback: export retained PD-06 history before applying.
DROP TABLE IF EXISTS deal_evidence_analysis_results;
DROP TABLE IF EXISTS deal_evidence_analysis_requests;
DROP TABLE IF EXISTS deal_evidence_attachments;
