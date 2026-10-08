-- Reverses drizzle/0070_uat_practice_books.sql exactly. Run only after the
-- application build that reads these columns has been rolled back (the Drizzle
-- schema selects practice_book_id on portfolio_accounts and broker_orders).
-- Book history (uat_* tables) is discarded; export it first if it matters.
ALTER TABLE broker_orders DROP INDEX broker_orders_book_idx, DROP COLUMN practice_book_id;
ALTER TABLE portfolio_accounts DROP COLUMN practice_book_id;
DROP TABLE uat_house_baselines;
DROP TABLE uat_book_adjustments;
DROP TABLE uat_practice_books;
