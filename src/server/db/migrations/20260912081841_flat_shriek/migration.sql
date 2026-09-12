CREATE TABLE `notificationDeliveries` (
	`id` text PRIMARY KEY,
	`incidentId` text NOT NULL,
	`destinationId` text NOT NULL,
	`monitorId` text NOT NULL,
	`status` text NOT NULL,
	`checkedAt` text NOT NULL,
	`error` text,
	`dueAt` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`deliveredAt` text,
	CONSTRAINT `fk_notificationDeliveries_incidentId_incidents_id_fk` FOREIGN KEY (`incidentId`) REFERENCES `incidents`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_notificationDeliveries_destinationId_notificationDestinations_id_fk` FOREIGN KEY (`destinationId`) REFERENCES `notificationDestinations`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_notificationDeliveries_monitorId_monitors_id_fk` FOREIGN KEY (`monitorId`) REFERENCES `monitors`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `monitors` ADD `retryAt` integer;--> statement-breakpoint
CREATE INDEX `incidents_monitor_opened_idx` ON `incidents` (`monitorId`,`openedAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `notification_delivery_event_idx` ON `notificationDeliveries` (`incidentId`,`destinationId`,`status`);--> statement-breakpoint
CREATE INDEX `notification_delivery_due_idx` ON `notificationDeliveries` (`deliveredAt`,`dueAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_single_admin_idx` ON `user` (`role`) WHERE "user"."role" = 'admin';