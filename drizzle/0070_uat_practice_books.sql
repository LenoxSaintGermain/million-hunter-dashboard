-- UAT Practice Books (UAT-E1). Additive only: two new tables for books and their
-- append-only adjustments, one table for the UAT house baseline, and one nullable
-- column each on portfolio_accounts and broker_orders. No existing row, balance,
-- order or gain is altered. Reverse with drizzle/rollback/0070_uat_practice_books.down.sql.
CREATE TABLE uat_practice_books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  portfolio_account_id INT NOT NULL,
  house_external_account_id VARCHAR(128) NULL,
  label VARCHAR(120) NOT NULL,
  scenario_preset VARCHAR(48) NOT NULL DEFAULT 'fresh_100k',
  starting_cash_cents BIGINT NOT NULL,
  status ENUM('active','frozen','archived') NOT NULL DEFAULT 'active',
  frozen_reason TEXT NULL,
  stale_snapshot_until BIGINT NULL,
  generation INT NOT NULL DEFAULT 1,
  created_by INT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  archived_at BIGINT NULL,
  KEY uat_books_user_status (user_id, status),
  KEY uat_books_account (portfolio_account_id, status)
);
CREATE TABLE uat_book_adjustments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NULL,
  kind ENUM('starting_cash','cash_adjustment','scenario_seed','corporate_action','reconciliation_writeoff','symbol_freeze','symbol_unfreeze') NOT NULL,
  symbol VARCHAR(24) NULL,
  qty DOUBLE NULL,
  price_cents BIGINT NULL,
  cash_cents BIGINT NULL,
  broker_backed BOOLEAN NOT NULL DEFAULT FALSE,
  house_external_account_id VARCHAR(128) NULL,
  note TEXT NOT NULL,
  created_by INT NOT NULL,
  created_at BIGINT NOT NULL,
  KEY uat_book_adj_book (book_id),
  KEY uat_book_adj_house_kind (house_external_account_id, kind, symbol)
);
CREATE TABLE uat_house_baselines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  house_external_account_id VARCHAR(128) NOT NULL,
  cash_cents BIGINT NULL,
  buying_power_cents BIGINT NULL,
  equity_value_cents BIGINT NULL,
  positions JSON NOT NULL,
  captured_by INT NULL,
  captured_at BIGINT NOT NULL,
  UNIQUE KEY uat_house_baselines_house_uq (house_external_account_id)
);
ALTER TABLE portfolio_accounts ADD COLUMN practice_book_id INT NULL;
ALTER TABLE broker_orders ADD COLUMN practice_book_id INT NULL, ADD INDEX broker_orders_book_idx (practice_book_id, status);
