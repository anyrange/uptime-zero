ALTER TABLE `monitors` ADD `sslExpiryWarnDays` integer;--> statement-breakpoint
ALTER TABLE `monitors` ADD `sslExpiryFailDays` integer;--> statement-breakpoint
ALTER TABLE `monitors` ADD `heartbeatMode` text DEFAULT 'interval' NOT NULL;--> statement-breakpoint
ALTER TABLE `monitors` ADD `heartbeatCron` text;--> statement-breakpoint
ALTER TABLE `monitors` ADD `heartbeatGraceSec` integer;--> statement-breakpoint
ALTER TABLE `monitors` ADD `heartbeatTimezone` text;