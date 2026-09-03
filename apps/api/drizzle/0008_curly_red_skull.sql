CREATE TABLE `batch_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`timestamp` text NOT NULL,
	`status` text NOT NULL,
	`note` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `batch_notes_batch_id_idx` ON `batch_notes` (`batch_id`);--> statement-breakpoint
CREATE INDEX `batch_notes_batch_time_idx` ON `batch_notes` (`batch_id`,`timestamp`);--> statement-breakpoint
ALTER TABLE `batches` ADD `measured_fg` real;--> statement-breakpoint
ALTER TABLE `batches` ADD `measured_bottling_size_l` real;--> statement-breakpoint
ALTER TABLE `batches` ADD `carbonation_type` text;--> statement-breakpoint
ALTER TABLE `batches` ADD `carbonation_volumes_target` real;--> statement-breakpoint
ALTER TABLE `batches` ADD `carbonation_temp_c` real;--> statement-breakpoint
ALTER TABLE `batches` ADD `taste_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `batches` ADD `taste_rating` integer;--> statement-breakpoint
ALTER TABLE `batches` ADD `bottling_date` text;--> statement-breakpoint
ALTER TABLE `batches` ADD `closing_snapshot` text;