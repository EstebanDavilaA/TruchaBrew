ALTER TABLE `equipment_profiles` ADD `mash_water_ratio_l_per_kg` real DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment_profiles` ADD `grain_absorption_l_per_kg` real DEFAULT 0.96 NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment_profiles` ADD `hopstand_utilization_factor` real DEFAULT 0.26 NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment_profiles` ADD `hopstand_temperature_c` real DEFAULT 79 NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment_profiles` ADD `sparge_temperature_c` real DEFAULT 76 NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment_profiles` ADD `mash_tun_heat_capacity_l` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment_profiles` ADD `grain_temperature_c` real DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment_profiles` ADD `notes` text DEFAULT '' NOT NULL;