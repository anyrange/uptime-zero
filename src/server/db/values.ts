import type {
  HeartbeatRecord,
  IncidentRecord,
  MonitorKind,
  MonitorRecord,
  MonitorStatus,
  NotificationDestinationConfig,
  NotificationProvider,
} from "@/types";

import { parseNotificationConfig } from "@/server/services/notifications/config";

const monitorKinds = ["http", "dns", "push"] as const;
const monitorStatuses = ["up", "down", "unknown"] as const;
const heartbeatModes = ["interval", "cron"] as const;
const heartbeatSources = ["poll", "push", "system"] as const;
const incidentStatuses = ["open", "closed"] as const;
const notificationProviders = ["discord", "webhook", "telegram"] as const;

export function readMonitorKind(value: string): MonitorKind {
  return includes(monitorKinds, value) ? value : "http";
}

export function readMonitorStatus(value: string): MonitorStatus {
  return includes(monitorStatuses, value) ? value : "unknown";
}

export function readHeartbeatSource(value: string): HeartbeatRecord["source"] {
  return includes(heartbeatSources, value) ? value : "system";
}

export function readHeartbeatMode(
  value: string,
): MonitorRecord["heartbeatMode"] {
  return includes(heartbeatModes, value) ? value : "interval";
}

export function readIncidentStatus(value: string): IncidentRecord["status"] {
  return includes(incidentStatuses, value) ? value : "closed";
}

export function readNotificationProvider(value: string): NotificationProvider {
  return includes(notificationProviders, value) ? value : "webhook";
}

export function readNotificationConfig(
  provider: string,
  configJson: string,
): NotificationDestinationConfig {
  return parseNotificationConfig(
    readNotificationProvider(provider),
    configJson,
  );
}

function includes<const T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return values.includes(value);
}
