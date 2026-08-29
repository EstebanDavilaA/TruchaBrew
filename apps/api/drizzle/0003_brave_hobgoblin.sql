CREATE TABLE `batches` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`batch_no` integer NOT NULL,
	`status` text NOT NULL,
	`recipe_id` text NOT NULL,
	`recipe_snapshot` text NOT NULL,
	`measured_pre_boil_gravity` real,
	`measured_mash_ph` real,
	`measured_boil_size_l` real,
	`measured_boil_time_min` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `batches_recipe_id_idx` ON `batches` (`recipe_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_recipe_hops` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`amount_g` real NOT NULL,
	`alpha_acid_pct` real NOT NULL,
	`use` text NOT NULL,
	`time_minutes` real DEFAULT 0 NOT NULL,
	`boil_mins` real,
	`whirlpool_mins` real,
	`whirlpool_temp_c` real,
	`type` text NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_recipe_hops`("id", "recipe_id", "position", "name", "amount_g", "alpha_acid_pct", "use", "time_minutes", "type") SELECT "id", "recipe_id", "position", "name", "amount_g", "alpha_acid_pct", "use", "time_minutes", "type" FROM `recipe_hops`;--> statement-breakpoint
DROP TABLE `recipe_hops`;--> statement-breakpoint
ALTER TABLE `__new_recipe_hops` RENAME TO `recipe_hops`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `recipe_hops_recipe_id_idx` ON `recipe_hops` (`recipe_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_hops_recipe_position_uq` ON `recipe_hops` (`recipe_id`,`position`);