-- Stage 1 Capital Operator: retain existing review rows while adding explicit
-- answer states for operator evidence decisions. No row is backfilled.
ALTER TABLE `aperture_evidence_reviews`
  MODIFY COLUMN `status` enum('reviewed','confirmed','not_confirmed','not_applicable','needs_follow_up') NOT NULL DEFAULT 'reviewed';
