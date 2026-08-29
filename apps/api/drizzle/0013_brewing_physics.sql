ALTER TABLE `equipment_profiles` ADD COLUMN `altitude_meters` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment_profiles` ADD COLUMN `calc_strike_with_thermal_mass` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment_profiles` ADD COLUMN `mash_tun_dead_space_l` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment_profiles` ADD COLUMN `kettle_loss_l` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment_profiles` ADD COLUMN `mash_tun_weight_kg` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment_profiles` ADD COLUMN `mash_tun_heat_capacity` real DEFAULT 0.12 NOT NULL;--> statement-breakpoint
ALTER TABLE `recipe_hops` ADD COLUMN `dry_hop_day_offset` integer;--> statement-breakpoint
ALTER TABLE `recipe_hops` ADD COLUMN `dry_hop_duration_days` real;
