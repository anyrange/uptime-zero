CREATE TABLE `account` (
	`id` text PRIMARY KEY,
	`userId` text NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`idToken` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	CONSTRAINT `fk_account_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `appSettings` (
	`id` text PRIMARY KEY,
	`heartbeatRetentionDays` integer DEFAULT 30 NOT NULL,
	`incidentRetentionDays` integer DEFAULT 90 NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `heartbeats` (
	`id` text PRIMARY KEY,
	`monitorId` text NOT NULL,
	`status` text NOT NULL,
	`statusCode` integer,
	`durationMs` integer,
	`error` text,
	`certDaysRemaining` integer,
	`createdAt` text NOT NULL,
	`source` text NOT NULL,
	CONSTRAINT `fk_heartbeats_monitorId_monitors_id_fk` FOREIGN KEY (`monitorId`) REFERENCES `monitors`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` text PRIMARY KEY,
	`monitorId` text NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`body` text,
	`pinned` integer DEFAULT 0 NOT NULL,
	`openedAt` text NOT NULL,
	`closedAt` text,
	CONSTRAINT `fk_incidents_monitorId_monitors_id_fk` FOREIGN KEY (`monitorId`) REFERENCES `monitors`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `monitors` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`target` text NOT NULL,
	`intervalSec` integer NOT NULL,
	`timeoutMs` integer NOT NULL,
	`retries` integer NOT NULL,
	`expectedStatus` integer,
	`keyword` text,
	`jsonPath` text,
	`jsonOperator` text,
	`jsonExpected` text,
	`pushToken` text UNIQUE,
	`active` integer DEFAULT 1 NOT NULL,
	`lastStatus` text DEFAULT 'unknown' NOT NULL,
	`lastCheckedAt` text,
	`lastDurationMs` integer,
	`lastError` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY,
	`userId` text NOT NULL,
	`token` text NOT NULL UNIQUE,
	`expiresAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	CONSTRAINT `fk_session_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `statusPageMonitors` (
	`statusPageId` text NOT NULL,
	`monitorId` text NOT NULL,
	CONSTRAINT `statusPageMonitors_pk` PRIMARY KEY(`statusPageId`, `monitorId`),
	CONSTRAINT `fk_statusPageMonitors_statusPageId_statusPages_id_fk` FOREIGN KEY (`statusPageId`) REFERENCES `statusPages`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_statusPageMonitors_monitorId_monitors_id_fk` FOREIGN KEY (`monitorId`) REFERENCES `monitors`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `statusPages` (
	`id` text PRIMARY KEY,
	`slug` text NOT NULL UNIQUE,
	`title` text NOT NULL,
	`description` text,
	`published` integer DEFAULT 1 NOT NULL,
	`showHistory` integer DEFAULT 1 NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'user',
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `account_provider_account_idx` ON `account` (`providerId`,`accountId`);--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE INDEX `heartbeats_monitor_created_idx` ON `heartbeats` (`monitorId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `incidents_status_opened_idx` ON `incidents` (`status`,`openedAt`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`userId`);