ALTER TABLE `recipes` ADD COLUMN `folder` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD COLUMN `tags` text DEFAULT '[]' NOT NULL;
