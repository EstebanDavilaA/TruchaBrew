CREATE TABLE IF NOT EXISTS `user_config` (
  `id` text PRIMARY KEY NOT NULL DEFAULT 'default',
  `unit_system` text NOT NULL DEFAULT 'metric',
  `gravity_unit` text NOT NULL DEFAULT 'sg',
  `temperature_unit` text NOT NULL DEFAULT 'celsius',
  `ibu_formula` text NOT NULL DEFAULT 'tinseth',
  `abv_formula` text NOT NULL DEFAULT 'simple',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT OR IGNORE INTO `user_config` (`id`, `unit_system`, `gravity_unit`, `temperature_unit`, `ibu_formula`, `abv_formula`)
VALUES ('default', 'metric', 'sg', 'celsius', 'tinseth', 'simple');
