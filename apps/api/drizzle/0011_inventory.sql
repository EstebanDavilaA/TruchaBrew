CREATE TABLE IF NOT EXISTS `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`cost_per_unit` real,
	`purchase_date` text,
	`expiry_date` text,
	`notes` text NOT NULL DEFAULT '',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `inventory_items_category_name_key_uq` ON `inventory_items` (`category`,`name_key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `inventory_items_category_idx` ON `inventory_items` (`category`);
