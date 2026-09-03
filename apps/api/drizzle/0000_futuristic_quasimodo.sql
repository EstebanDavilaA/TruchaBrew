CREATE TABLE `catalog_fermentables` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`color_srm` real NOT NULL,
	`potential_sg` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catalog_hops` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`alpha_acid_pct` real NOT NULL,
	`type` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catalog_miscs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`default_use` text NOT NULL,
	`default_unit` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catalog_yeasts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`laboratory` text NOT NULL,
	`type` text NOT NULL,
	`form` text NOT NULL,
	`attenuation_pct` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `equipment_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`batch_size_l` real NOT NULL,
	`boil_time_min` real NOT NULL,
	`brewhouse_efficiency_pct` real NOT NULL,
	`mash_efficiency_pct` real NOT NULL,
	`boil_off_rate_l_per_hour` real NOT NULL,
	`trub_chiller_loss_l` real NOT NULL,
	`hop_utilization_pct` real NOT NULL,
	`derived_from_equipment_id` text,
	`is_seed` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`derived_from_equipment_id`) REFERENCES `equipment_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `recipe_fermentables` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`amount_kg` real NOT NULL,
	`color_srm` real NOT NULL,
	`potential_sg` real NOT NULL,
	`notes` text,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_fermentables_recipe_id_idx` ON `recipe_fermentables` (`recipe_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_fermentables_recipe_position_uq` ON `recipe_fermentables` (`recipe_id`,`position`);--> statement-breakpoint
CREATE TABLE `recipe_hops` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`amount_g` real NOT NULL,
	`alpha_acid_pct` real NOT NULL,
	`use` text NOT NULL,
	`time_minutes` real NOT NULL,
	`type` text NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_hops_recipe_id_idx` ON `recipe_hops` (`recipe_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_hops_recipe_position_uq` ON `recipe_hops` (`recipe_id`,`position`);--> statement-breakpoint
CREATE TABLE `recipe_miscs` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`use` text NOT NULL,
	`time_minutes` real NOT NULL,
	`amount` real NOT NULL,
	`unit` text NOT NULL,
	`notes` text,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_miscs_recipe_id_idx` ON `recipe_miscs` (`recipe_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_miscs_recipe_position_uq` ON `recipe_miscs` (`recipe_id`,`position`);--> statement-breakpoint
CREATE TABLE `recipe_yeasts` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`form` text NOT NULL,
	`laboratory` text NOT NULL,
	`attenuation_pct` real NOT NULL,
	`amount_pkg` real NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_yeasts_recipe_id_idx` ON `recipe_yeasts` (`recipe_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_yeasts_recipe_position_uq` ON `recipe_yeasts` (`recipe_id`,`position`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`style_name` text DEFAULT '' NOT NULL,
	`equipment_id` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment_profiles`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `recipes_name_idx` ON `recipes` (`name`);