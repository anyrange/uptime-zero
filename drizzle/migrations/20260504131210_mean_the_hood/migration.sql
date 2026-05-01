ALTER TABLE `monitors` ADD `lastCertValidTo` text;--> statement-breakpoint
ALTER TABLE `monitors` ADD `lastCertDaysRemaining` integer;--> statement-breakpoint
ALTER TABLE `monitors` ADD `lastCertHostname` text;--> statement-breakpoint
ALTER TABLE `monitors` ADD `lastSslStatus` text;