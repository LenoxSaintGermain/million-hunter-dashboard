ALTER TABLE aperture_play_slates
  ADD COLUMN window_key VARCHAR(64) NOT NULL DEFAULT 'opening' AFTER session_date_et;

ALTER TABLE aperture_play_slates
  ADD COLUMN snapshot_basis ENUM('live_capture', 'historical_reconstruction') NOT NULL DEFAULT 'live_capture' AFTER window_key;

ALTER TABLE aperture_play_slates
  DROP INDEX aperture_play_slate_user_thesis_date_unique,
  ADD UNIQUE KEY aperture_play_slate_user_thesis_date_window_unique (user_id, canonical_thesis_id, session_date_et, window_key);
