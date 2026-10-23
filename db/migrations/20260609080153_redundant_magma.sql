ALTER TABLE `monitors` ADD `notificationGraceSec` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `monitors` ADD `lastDownNotifiedAt` text;