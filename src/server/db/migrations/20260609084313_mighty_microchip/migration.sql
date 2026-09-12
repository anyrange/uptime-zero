ALTER TABLE `heartbeats` DROP COLUMN `certDaysRemaining`;--> statement-breakpoint
ALTER TABLE `monitors` DROP COLUMN `sslExpiryWarnDays`;--> statement-breakpoint
ALTER TABLE `monitors` DROP COLUMN `sslExpiryFailDays`;--> statement-breakpoint
ALTER TABLE `monitors` DROP COLUMN `lastCertValidTo`;--> statement-breakpoint
ALTER TABLE `monitors` DROP COLUMN `lastCertDaysRemaining`;--> statement-breakpoint
ALTER TABLE `monitors` DROP COLUMN `lastCertHostname`;--> statement-breakpoint
ALTER TABLE `monitors` DROP COLUMN `lastSslStatus`;