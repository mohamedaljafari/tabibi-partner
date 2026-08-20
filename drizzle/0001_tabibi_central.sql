CREATE TABLE `tabibi_users` (
	`id` varchar(48) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`role` enum('patient','provider','admin') NOT NULL,
	`display_name` varchar(160) NOT NULL,
	`password_hash` text NOT NULL,
	`status` enum('active','pending','rejected','suspended') NOT NULL DEFAULT 'active',
	`failed_attempts` int NOT NULL DEFAULT 0,
	`locked_until` timestamp NULL,
	`metadata` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tabibi_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `tabibi_users_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `tabibi_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(48) NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `tabibi_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `tabibi_sessions_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `tabibi_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`collection` varchar(64) NOT NULL,
	`owner_key` varchar(128) NOT NULL,
	`payload` json NOT NULL,
	`created_by` varchar(48) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tabibi_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `tabibi_records_owner_key_unique` UNIQUE(`owner_key`)
);
