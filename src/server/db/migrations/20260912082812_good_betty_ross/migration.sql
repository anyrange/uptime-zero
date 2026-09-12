ALTER TABLE `monitors` ADD `revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `monitors` DROP COLUMN `lastDownNotifiedAt`;