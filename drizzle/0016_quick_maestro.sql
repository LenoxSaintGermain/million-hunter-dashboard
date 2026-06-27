CREATE TABLE `role_module_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role` enum('operator','admin','investor','insurance','user') NOT NULL,
	`module_key` varchar(64) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `role_module_permissions_id` PRIMARY KEY(`id`)
);
