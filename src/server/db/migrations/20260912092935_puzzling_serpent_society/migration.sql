CREATE INDEX `heartbeats_status_created_idx` ON `heartbeats` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `incidents_monitor_status_idx` ON `incidents` (`monitorId`,`status`);