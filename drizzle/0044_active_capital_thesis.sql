ALTER TABLE users ADD COLUMN active_capital_thesis_id INT NULL;
CREATE INDEX idx_users_active_capital_thesis ON users (active_capital_thesis_id);
