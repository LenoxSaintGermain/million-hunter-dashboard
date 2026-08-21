-- One owner-scoped, research-only post-open Capital Brief. Additive; no orders,
-- proposals, broker credentials, or brokerage records are modified by this state.
ALTER TABLE users ADD COLUMN one_time_research_task_uid varchar(65) NULL;
ALTER TABLE users ADD COLUMN one_time_research_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN one_time_research_status enum('queued','running','completed','failed','paused') NULL DEFAULT 'queued';
ALTER TABLE users ADD COLUMN one_time_research_target_at bigint NULL;
ALTER TABLE users ADD COLUMN one_time_research_thesis_id int NULL;
ALTER TABLE users ADD COLUMN one_time_research_run_id int NULL;
ALTER TABLE users ADD COLUMN one_time_research_last_result text NULL;
CREATE UNIQUE INDEX users_one_time_research_task_uid_uq ON users (one_time_research_task_uid);
