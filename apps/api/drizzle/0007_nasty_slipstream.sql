CREATE TABLE `batch_readings` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`reading_time` text NOT NULL,
	`sg` real,
	`temp_c` real,
	`comment` text DEFAULT '' NOT NULL,
	`ph` real,
	`pressure_psi` real,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `batch_readings_batch_id_idx` ON `batch_readings` (`batch_id`);--> statement-breakpoint
CREATE INDEX `batch_readings_batch_time_idx` ON `batch_readings` (`batch_id`,`reading_time`);--> statement-breakpoint
ALTER TABLE `batches` ADD `measured_og` real;--> statement-breakpoint
ALTER TABLE `batches` ADD `fermentation_start_date` text;