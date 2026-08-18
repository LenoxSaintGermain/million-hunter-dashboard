-- 0037 — Aperture cockpit: persist the set-aside list.
--
-- WHAT WAS LOST. `assembleRun` (server/aperture/run.ts) has always produced
-- `setAside: Array<{ symbol, reason }>` — every symbol a hard stop dropped, in
-- the scorer's own words. `executeRun` persisted candidates, strategies and
-- exposure coverage and then discarded that array. Only `aperture_runs.
-- dropped_note` survived, and that is a one-line universe-cap summary, not a
-- per-symbol record. So the run could report "29 candidates" but could not
-- answer "what did you look at and reject, and why" — which is the entire
-- difference between this and a screener. Every run since the feature shipped
-- has thrown the answer away.
--
-- WHY A TABLE, NOT A JSON COLUMN. A `set_aside` json column on aperture_runs
-- would have been one line of migration, and it is the wrong shape:
--   · a name that fails the same hard stop in five consecutive runs is a signal
--     about the thesis, and that query is trivial against rows and painful
--     against blobs;
--   · this list joins to aperture_candidates by (run_id, symbol) exactly the way
--     exposure_coverage already does, so it should look like exposure_coverage;
--   · a blob column means rewriting the runs row late in the pipeline, when the
--     status write is the only thing that should still be touching it.
--
-- Nothing is backfilled. Runs completed before this migration carry no rows,
-- which reads as "not recorded" — NOT as "nothing was set aside". The client
-- must render the difference (a run whose `completedAt` predates this table has
-- an unrecorded set-aside list, not an empty one).

CREATE TABLE IF NOT EXISTS `aperture_set_aside` (
  `id` int NOT NULL AUTO_INCREMENT,
  `run_id` int NOT NULL,
  `symbol` varchar(24) NOT NULL,
  `reason` text NOT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `aperture_set_aside_run_idx` (`run_id`)
);
