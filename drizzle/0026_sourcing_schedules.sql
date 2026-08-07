-- 0026 — scheduled sourcing.
--
-- Daily/weekly automated sourcing runs, DISABLED by default: nothing spends
-- tokens until someone explicitly turns it on. Each schedule records its own
-- run history so an unattended job can't silently do nothing (or silently do
-- too much) for weeks.

CREATE TABLE IF NOT EXISTS `sourcing_schedules` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(120) NOT NULL,
  `asset_class` varchar(64) NOT NULL DEFAULT 'historic',
  `enabled` boolean NOT NULL DEFAULT false,
  `cadence` varchar(16) NOT NULL DEFAULT 'daily',
  `hour_utc` int NOT NULL DEFAULT 9,
  `nationwide` boolean NOT NULL DEFAULT false,
  `markets_per_run` int NOT NULL DEFAULT 5,
  `limit_per_run` int NOT NULL DEFAULT 10,
  `last_run_at` bigint,
  `last_run_created` int,
  `last_run_message` text,
  `next_run_at` bigint,
  `created_by_user_id` int,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  CONSTRAINT `sourcing_schedules_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `sourcing_runs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `schedule_id` int,
  `asset_class` varchar(64) NOT NULL,
  `trigger` varchar(16) NOT NULL DEFAULT 'schedule',
  `created_count` int NOT NULL DEFAULT 0,
  `researched_count` int NOT NULL DEFAULT 0,
  `markets` json,
  `message` text,
  `error` text,
  `ran_at` bigint NOT NULL,
  `duration_ms` int,
  CONSTRAINT `sourcing_runs_id` PRIMARY KEY(`id`)
);
