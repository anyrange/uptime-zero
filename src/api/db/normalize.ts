import type { schema } from "@/api/db";
import type {
  HeartbeatRecord,
  IncidentListRecord,
  IncidentRecord,
  MonitorKind,
  MonitorRecord,
  MonitorSslStatus,
  MonitorStatus,
  NotificationDestinationConfig,
  NotificationDestinationDetail,
  NotificationDestinationListItem,
  NotificationDestinationMonitorSummary,
  NotificationDestinationRecord,
  NotificationProvider,
  StatusPageRecord,
} from "@/types";

import { parseNotificationConfig } from "@/api/lib/notifications";
import { normalizeMonitorAssertions } from "@/lib/monitor-assertions";

const monitorKinds = ["http", "dns", "push"] as const;
const monitorStatuses = ["up", "down", "unknown"] as const;
const monitorSslStatuses = [
  "valid",
  "expiring",
  "expired",
  "unavailable",
] as const;
const heartbeatSources = ["poll", "push", "system"] as const;
const incidentStatuses = ["open", "closed"] as const;
const notificationProviders = ["discord", "webhook", "telegram"] as const;

type MonitorRow = typeof schema.monitors.$inferSelect;
type HeartbeatRow = typeof schema.heartbeats.$inferSelect;
type IncidentRow = typeof schema.incidents.$inferSelect;
type StatusPageRow = typeof schema.statusPages.$inferSelect;
type NotificationDestinationRow =
  typeof schema.notificationDestinations.$inferSelect;

export type NotificationDestinationRecordRow = Pick<
  NotificationDestinationRow,
  "id" | "name" | "provider" | "configJson" | "createdAt" | "updatedAt"
>;

export type IncidentListRecordRow = Omit<
  IncidentListRecord,
  "status" | "monitorKind" | "monitorLastStatus"
> & {
  status: string;
  monitorKind: string;
  monitorLastStatus: string;
};

export function mapMonitorRecord(row: MonitorRow) {
  return {
    ...row,
    kind: normalizeMonitorKind(row.kind),
    assertions: normalizeMonitorAssertions(row.assertionsJson ?? null),
    lastStatus: normalizeMonitorStatus(row.lastStatus),
    lastSslStatus: normalizeMonitorSslStatus(row.lastSslStatus),
  } satisfies MonitorRecord;
}

export function mapHeartbeatRecord(row: HeartbeatRow) {
  return {
    ...row,
    status: normalizeMonitorStatus(row.status),
    source: normalizeHeartbeatSource(row.source),
  } satisfies HeartbeatRecord;
}

export function mapIncidentRecord(row: IncidentRow) {
  return {
    ...row,
    status: normalizeIncidentStatus(row.status),
  } satisfies IncidentRecord;
}

export function mapStatusPageRecord(row: StatusPageRow) {
  return { ...row } satisfies StatusPageRecord;
}

export function mapNotificationDestinationRecord(
  row: NotificationDestinationRecordRow,
) {
  const provider = normalizeNotificationProvider(row.provider);
  return {
    id: row.id,
    name: row.name,
    provider,
    configJson: row.configJson,
    config: parseNotificationConfig(provider, row.configJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } satisfies NotificationDestinationRecord;
}

export function mapNotificationDestinationListItem(
  row: NotificationDestinationRecordRow,
  assignments: Map<string, NotificationDestinationMonitorSummary[]>,
) {
  const record = mapNotificationDestinationRecord(row);
  const assignedMonitors = assignments.get(row.id) ?? [];
  return {
    ...record,
    monitorCount: assignedMonitors.length,
    assignedMonitors,
  } satisfies NotificationDestinationListItem;
}

export function mapNotificationDestinationDetail(
  row: NotificationDestinationRecordRow,
  assignments: Map<string, NotificationDestinationMonitorSummary[]>,
) {
  const record = mapNotificationDestinationRecord(row);
  const assignedMonitors = assignments.get(row.id) ?? [];
  return {
    ...record,
    monitorIds: assignedMonitors.map((monitor) => monitor.id),
  } satisfies NotificationDestinationDetail;
}

export function mapIncidentListRecord(row: IncidentListRecordRow) {
  return {
    ...row,
    monitorKind: normalizeMonitorKind(row.monitorKind),
    monitorLastStatus: normalizeMonitorStatus(row.monitorLastStatus),
    status: normalizeIncidentStatus(row.status),
  } satisfies IncidentListRecord;
}

export function normalizeMonitorKind(value: string): MonitorKind {
  return includes(monitorKinds, value) ? value : "http";
}

export function normalizeMonitorStatus(value: string): MonitorStatus {
  return includes(monitorStatuses, value) ? value : "unknown";
}

export function normalizeMonitorSslStatus(
  value: string | null,
): MonitorSslStatus | null {
  if (value == null) {
    return null;
  }
  return includes(monitorSslStatuses, value) ? value : null;
}

export function normalizeHeartbeatSource(
  value: string,
): HeartbeatRecord["source"] {
  return includes(heartbeatSources, value) ? value : "system";
}

export function normalizeIncidentStatus(
  value: string,
): IncidentRecord["status"] {
  return includes(incidentStatuses, value) ? value : "closed";
}

export function normalizeNotificationProvider(
  value: string,
): NotificationProvider {
  return includes(notificationProviders, value) ? value : "webhook";
}

export function normalizeNotificationConfig(
  provider: string,
  configJson: string,
): NotificationDestinationConfig {
  return parseNotificationConfig(
    normalizeNotificationProvider(provider),
    configJson,
  );
}

function includes<const T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return values.includes(value);
}
