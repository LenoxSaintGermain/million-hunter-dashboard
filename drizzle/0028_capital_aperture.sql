-- 0028 — Capital Aperture: the second engine.
--
-- The property/business engine answers "does this one illiquid thing qualify?".
-- Capital Aperture answers "given a thesis, a portfolio, and $X of deployable
-- capital, what is the best way to deploy the next dollar?" — which needs four
-- primitives the existing schema has none of: position state, price data,
-- cross-asset exposure, and allocation over a SET rather than a row.
--
-- Deliberately separate from `commercial_assets`. A security has no address, and
-- forcing one in would have meant inventing data on day one.
--
-- MONEY IS IN CENTS. Every monetary column is named `..._cents`.
-- Admin-only surface — see ADMIN_ONLY_MODULES in server/rolePermissionsRouter.ts.

-- ── Duplicate-account pointer (non-destructive, reversible) ──────────────────
ALTER TABLE `users` ADD COLUMN `merged_into_user_id` int;

-- ── The Thesis Graph ────────────────────────────────────────────────────────
CREATE TABLE `capital_theses` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `name` varchar(160),
  `raw_text` text NOT NULL,
  `graph` json,
  `confidence_notes` json,
  `status` enum('compiling','review','active','archived') NOT NULL DEFAULT 'compiling',
  `is_primary` boolean NOT NULL DEFAULT false,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  CONSTRAINT `capital_theses_id` PRIMARY KEY(`id`)
);
CREATE INDEX `capital_theses_user_idx` ON `capital_theses` (`user_id`);

-- ── Broker-agnostic portfolio state ─────────────────────────────────────────
CREATE TABLE `portfolio_accounts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `label` varchar(120) NOT NULL,
  `broker_id` varchar(32) NOT NULL DEFAULT 'manual',
  `external_account_id` varchar(128),
  `is_paper` boolean NOT NULL DEFAULT true,
  `cash_cents` bigint,
  `buying_power_cents` bigint,
  `equity_value_cents` bigint,
  `last_synced_at` bigint,
  `sync_source` varchar(64),
  `sync_error` text,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  CONSTRAINT `portfolio_accounts_id` PRIMARY KEY(`id`)
);
CREATE INDEX `portfolio_accounts_user_idx` ON `portfolio_accounts` (`user_id`);

CREATE TABLE `positions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `account_id` int NOT NULL,
  `symbol` varchar(24) NOT NULL,
  `asset_type` enum('equity','etf','option','crypto','cash') NOT NULL DEFAULT 'equity',
  `qty` float NOT NULL,
  `avg_cost_cents` bigint,
  `last_price_cents` bigint,
  `market_value_cents` bigint,
  `price_as_of` bigint,
  `price_source` varchar(64),
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  CONSTRAINT `positions_id` PRIMARY KEY(`id`)
);
CREATE INDEX `positions_account_idx` ON `positions` (`account_id`);
CREATE INDEX `positions_symbol_idx` ON `positions` (`symbol`);

-- ── Securities + the fact ledger ────────────────────────────────────────────
CREATE TABLE `securities` (
  `id` int AUTO_INCREMENT NOT NULL,
  `symbol` varchar(24) NOT NULL,
  `name` varchar(255),
  `exchange` varchar(32),
  `sector` varchar(96),
  `industry` varchar(128),
  `cik` varchar(16),
  `asset_type` enum('equity','etf','option','crypto') NOT NULL DEFAULT 'equity',
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  CONSTRAINT `securities_id` PRIMARY KEY(`id`),
  CONSTRAINT `securities_symbol_unique` UNIQUE(`symbol`)
);

-- The honesty contract made structural: no number reaches a memo, a score, or a
-- strategy without a row here to back it. `basis` is never optional, and a
-- `modeled` row must carry the assumption it depends on.
CREATE TABLE `security_facts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `symbol` varchar(24) NOT NULL,
  `fact_key` varchar(80) NOT NULL,
  `value_num` float,
  `value_text` text,
  `unit` varchar(24),
  `basis` enum('verified','modeled','unknown') NOT NULL,
  `assumption` text,
  `provider_id` varchar(32) NOT NULL,
  `source_name` varchar(160),
  `source_url` text,
  `as_of` bigint,
  `fetched_at` bigint NOT NULL,
  `expires_at` bigint,
  CONSTRAINT `security_facts_id` PRIMARY KEY(`id`)
);
CREATE INDEX `security_facts_symbol_key_idx` ON `security_facts` (`symbol`, `fact_key`);
CREATE INDEX `security_facts_expiry_idx` ON `security_facts` (`expires_at`);

-- ── Runs, candidates, strategies ────────────────────────────────────────────
CREATE TABLE `aperture_runs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `thesis_id` int NOT NULL,
  `account_id` int,
  `deployable_capital_cents` bigint NOT NULL,
  `intended_trades` json,
  `hurdle_rate_bps` int,
  `status` enum('queued','compiling','discovering','researching','scoring','constructing','completed','failed') NOT NULL DEFAULT 'queued',
  `universe_count` int,
  `candidate_count` int,
  `dropped_note` text,
  `provider_availability` json,
  `error` text,
  `started_at` bigint,
  `completed_at` bigint,
  `created_at` bigint NOT NULL,
  CONSTRAINT `aperture_runs_id` PRIMARY KEY(`id`)
);
CREATE INDEX `aperture_runs_user_idx` ON `aperture_runs` (`user_id`);

CREATE TABLE `aperture_candidates` (
  `id` int AUTO_INCREMENT NOT NULL,
  `run_id` int NOT NULL,
  `symbol` varchar(24) NOT NULL,
  `role` enum('core','complementary','remainder','alternative_expression') NOT NULL,
  `composite_score` int,
  `confidence_score` float,
  `rank_score` float,
  `dimensions` json,
  `verify_fields` json,
  `exposure_node_ids` json,
  `memo` json,
  `memo_status` enum('pending','ok','rejected','skipped') NOT NULL DEFAULT 'pending',
  `memo_reject_reason` text,
  `citations` json,
  `suggested_size_low_cents` bigint,
  `suggested_size_high_cents` bigint,
  `created_at` bigint NOT NULL,
  CONSTRAINT `aperture_candidates_id` PRIMARY KEY(`id`)
);
CREATE INDEX `aperture_candidates_run_idx` ON `aperture_candidates` (`run_id`);

CREATE TABLE `aperture_strategies` (
  `id` int AUTO_INCREMENT NOT NULL,
  `run_id` int NOT NULL,
  `kind` enum('concentrated','expanded','risk_balanced','dry_powder','human_baseline') NOT NULL,
  `label` varchar(120) NOT NULL,
  `rationale` text,
  `allocations` json,
  `cash_retained_cents` bigint,
  `portfolio_impact` json,
  `opportunity_cost` json,
  `created_at` bigint NOT NULL,
  CONSTRAINT `aperture_strategies_id` PRIMARY KEY(`id`)
);
CREATE INDEX `aperture_strategies_run_idx` ON `aperture_strategies` (`run_id`);

-- ── The Exposure Mapper ─────────────────────────────────────────────────────
CREATE TABLE `exposure_nodes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `thesis_id` int NOT NULL,
  `parent_id` int,
  `label` varchar(160) NOT NULL,
  `depth` int NOT NULL DEFAULT 0,
  `path` varchar(512),
  `created_at` bigint NOT NULL,
  CONSTRAINT `exposure_nodes_id` PRIMARY KEY(`id`)
);
CREATE INDEX `exposure_nodes_thesis_idx` ON `exposure_nodes` (`thesis_id`);

CREATE TABLE `exposure_coverage` (
  `id` int AUTO_INCREMENT NOT NULL,
  `run_id` int NOT NULL,
  `node_id` int NOT NULL,
  `symbol` varchar(24) NOT NULL,
  `weight_pct` float,
  `source` enum('holding','intended','candidate') NOT NULL,
  CONSTRAINT `exposure_coverage_id` PRIMARY KEY(`id`)
);
CREATE INDEX `exposure_coverage_run_idx` ON `exposure_coverage` (`run_id`);
