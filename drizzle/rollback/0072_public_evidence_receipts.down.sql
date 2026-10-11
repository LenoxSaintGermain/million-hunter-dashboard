-- Destructive rollback: export receipts first if they must be retained.
-- Never run automatically against production.
DROP TABLE IF EXISTS public_evidence_budgets;
DROP TABLE IF EXISTS public_evidence_capture_claims;
DROP TABLE IF EXISTS public_evidence_receipts;
