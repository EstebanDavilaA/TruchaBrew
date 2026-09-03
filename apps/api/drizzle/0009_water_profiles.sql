CREATE TABLE IF NOT EXISTS `water_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`calcium` real NOT NULL DEFAULT 0,
	`magnesium` real NOT NULL DEFAULT 0,
	`sodium` real NOT NULL DEFAULT 0,
	`chloride` real NOT NULL DEFAULT 0,
	`sulfate` real NOT NULL DEFAULT 0,
	`bicarbonate` real NOT NULL DEFAULT 0,
	`ph` real,
	`description` text,
	`is_seed` integer NOT NULL DEFAULT 0,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `recipes` ADD COLUMN `water_source_id` text REFERENCES `water_profiles`(`id`);
--> statement-breakpoint
ALTER TABLE `recipes` ADD COLUMN `water_target_id` text REFERENCES `water_profiles`(`id`);
