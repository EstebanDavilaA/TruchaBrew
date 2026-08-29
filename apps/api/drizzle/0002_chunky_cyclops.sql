CREATE TABLE `fermentation_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_seed` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fermentation_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`fermentation_profile_id` text NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`step_temp_c` real NOT NULL,
	`step_time_days` real NOT NULL,
	`ramp_days` real NOT NULL,
	`pressure_psi` real,
	FOREIGN KEY (`fermentation_profile_id`) REFERENCES `fermentation_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `fermentation_steps_profile_id_idx` ON `fermentation_steps` (`fermentation_profile_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `fermentation_steps_profile_position_uq` ON `fermentation_steps` (`fermentation_profile_id`,`position`);--> statement-breakpoint
CREATE TABLE `mash_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`target_ph` real DEFAULT 5.4 NOT NULL,
	`sparge_temp_c` real,
	`is_seed` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mash_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`mash_profile_id` text NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`step_temp_c` real NOT NULL,
	`step_time_min` real NOT NULL,
	`ramp_time_min` real NOT NULL,
	`infuse_amount_l` real,
	`infuse_water_temp_c` real DEFAULT 100 NOT NULL,
	FOREIGN KEY (`mash_profile_id`) REFERENCES `mash_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mash_steps_profile_id_idx` ON `mash_steps` (`mash_profile_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `mash_steps_profile_position_uq` ON `mash_steps` (`mash_profile_id`,`position`);--> statement-breakpoint
ALTER TABLE `recipes` ADD `mash_profile_id` text REFERENCES mash_profiles(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `recipes` ADD `fermentation_profile_id` text REFERENCES fermentation_profiles(id) ON DELETE set null;