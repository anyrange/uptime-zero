CREATE TABLE `monitorNotificationDestinations` (
	`monitorId` text NOT NULL,
	`notificationDestinationId` text NOT NULL,
	CONSTRAINT `monitorNotificationDestinations_pk` PRIMARY KEY(`monitorId`, `notificationDestinationId`),
	CONSTRAINT `fk_monitorNotificationDestinations_monitorId_monitors_id_fk` FOREIGN KEY (`monitorId`) REFERENCES `monitors`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_monitorNotificationDestinations_notificationDestinationId_notificationDestinations_id_fk` FOREIGN KEY (`notificationDestinationId`) REFERENCES `notificationDestinations`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `notificationDestinations` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`configJson` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `notificationDestinations` (`id`, `name`, `provider`, `configJson`, `createdAt`, `updatedAt`)
SELECT
	`id`,
	`name`,
	'webhook',
	json_object('url', `url`),
	`createdAt`,
	`createdAt`
FROM `webhooks`;
--> statement-breakpoint
CREATE INDEX `notification_destinations_provider_created_idx` ON `notificationDestinations` (`provider`,`createdAt`);--> statement-breakpoint
DROP TABLE `webhooks`;
