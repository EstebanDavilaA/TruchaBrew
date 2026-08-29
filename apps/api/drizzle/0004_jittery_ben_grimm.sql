UPDATE `recipe_hops` SET `boil_mins` = `time_minutes` WHERE `use` IN ('Boil', 'FirstWort');
--> statement-breakpoint
UPDATE `recipe_hops` 
SET `whirlpool_mins` = `time_minutes`,
    `whirlpool_temp_c` = (
       SELECT `hopstand_temperature_c` 
       FROM `equipment_profiles` 
       JOIN `recipes` ON `recipes`.`equipment_id` = `equipment_profiles`.`id`
       WHERE `recipes`.`id` = `recipe_hops`.`recipe_id`
    )
WHERE `use` IN ('Whirlpool', 'Aroma');
--> statement-breakpoint
ALTER TABLE `recipe_hops` DROP COLUMN `time_minutes`;