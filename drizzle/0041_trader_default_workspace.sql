ALTER TABLE `users` MODIFY COLUMN `default_workspace` enum('command_center','capital_aperture','capital_aperture_trader') NOT NULL DEFAULT 'command_center';
