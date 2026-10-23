CREATE TABLE `heartbeatDaily` (
	`monitorId` text NOT NULL,
	`day` text NOT NULL,
	`total` integer NOT NULL,
	`up` integer NOT NULL,
	`down` integer NOT NULL,
	`unknown` integer NOT NULL,
	CONSTRAINT `heartbeatDaily_pk` PRIMARY KEY(`monitorId`, `day`),
	CONSTRAINT `fk_heartbeatDaily_monitorId_monitors_id_fk` FOREIGN KEY (`monitorId`) REFERENCES `monitors`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `incidents_status_closed_idx` ON `incidents` (`status`,`closedAt`);--> statement-breakpoint
CREATE INDEX `monitors_active_idx` ON `monitors` (`active`);--> statement-breakpoint
CREATE INDEX `session_expires_idx` ON `session` (`expiresAt`);