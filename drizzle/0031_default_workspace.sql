ALTER TABLE `users`
  ADD COLUMN `default_workspace` enum('command_center','capital_aperture') NOT NULL DEFAULT 'command_center';
