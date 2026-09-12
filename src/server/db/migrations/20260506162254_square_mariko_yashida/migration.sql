ALTER TABLE `monitors` ADD `assertionsJson` text;--> statement-breakpoint
ALTER TABLE `monitors` DROP COLUMN `expectedStatus`;--> statement-breakpoint
ALTER TABLE `monitors` DROP COLUMN `keyword`;--> statement-breakpoint
ALTER TABLE `monitors` DROP COLUMN `jsonPath`;--> statement-breakpoint
ALTER TABLE `monitors` DROP COLUMN `jsonOperator`;--> statement-breakpoint
ALTER TABLE `monitors` DROP COLUMN `jsonExpected`;