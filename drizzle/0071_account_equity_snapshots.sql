-- Account equity snapshots (Performance view, PR A). Additive only: one new
-- append-only table, one row per saved account sync, de-duplicated to a 5-minute
-- bucket so the scheduled sync and a manual sync cannot double-write. Nothing
-- existing is altered. Reverse with drizzle/rollback/0071_account_equity_snapshots.down.sql.
CREATE TABLE account_equity_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  user_id INT NOT NULL,
  practice_book_id INT NULL,
  equity_cents BIGINT NOT NULL,
  cash_cents BIGINT NULL,
  source VARCHAR(32) NOT NULL,
  taken_at BIGINT NOT NULL,
  bucket_ts BIGINT NOT NULL,
  UNIQUE KEY equity_snap_account_bucket (account_id, bucket_ts),
  KEY equity_snap_user_account_time (user_id, account_id, taken_at)
);
