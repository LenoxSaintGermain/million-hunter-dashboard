ALTER TABLE `aperture_runs`
  ADD COLUMN `instrument_preference` enum('shares','options','either') AFTER `holding_period`;
