CREATE TABLE IF NOT EXISTS `inventory_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`inventory_item_id` text NOT NULL,
	`kind` text NOT NULL,
	`reverses_transaction_id` text,
	`category` text NOT NULL,
	`display_name` text NOT NULL,
	`name_key` text NOT NULL,
	`amount` real NOT NULL,
	`unit` text NOT NULL,
	`cost_per_unit` real,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `inventory_transactions_batch_idx` ON `inventory_transactions` (`batch_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `inventory_transactions_item_idx` ON `inventory_transactions` (`inventory_item_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `inventory_transactions_reverses_uq` ON `inventory_transactions` (`reverses_transaction_id`);
