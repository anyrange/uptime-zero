export type MonitorKind = "http" | "dns" | "push";

export type MonitorStatus = "up" | "down" | "unknown";

export type HeartbeatMode = "interval" | "cron";

export type JsonOperator =
  | "eq"
  | "ne"
  | "includes"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

export type TextAssertionOperator = "contains" | "equals" | "not_contains";

export type DnsRecordType = "A" | "AAAA" | "CNAME" | "MX" | "NS" | "TXT";

export type MonitorAssertion =
  | {
      id: string;
      type: "status";
      expected: number;
    }
  | {
      id: string;
      type: "header";
      header: string;
      operator: TextAssertionOperator;
      value: string;
    }
  | {
      id: string;
      type: "body";
      source: "text";
      operator: TextAssertionOperator;
      value: string;
    }
  | {
      id: string;
      type: "body";
      source: "json";
      path: string;
      operator: JsonOperator;
      value: string;
    }
  | {
      id: string;
      type: "record";
      recordType: DnsRecordType;
      operator: TextAssertionOperator;
      value: string;
    };

export interface MonitorRecord {
  id: string;
  name: string;
  kind: MonitorKind;
  target: string;
  intervalSec: number;
  timeoutMs: number;
  retries: number;
  assertions: MonitorAssertion[];
  heartbeatMode: HeartbeatMode;
  heartbeatCron: string | null;
  heartbeatGraceSec: number | null;
  heartbeatTimezone: string | null;
  notificationGraceSec: number;
  pushToken: string | null;
  active: number;
  lastStatus: MonitorStatus;
  lastCheckedAt: string | null;
  lastDurationMs: number | null;
  lastError: string | null;
  lastDownNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HeartbeatRecord {
  id: string;
  monitorId: string;
  status: MonitorStatus;
  statusCode: number | null;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
  source: "poll" | "push" | "system";
}

export interface HeartbeatPage {
  heartbeats: HeartbeatRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface IncidentRecord {
  id: string;
  monitorId: string;
  title: string;
  status: "open" | "closed";
  body: string | null;
  pinned: number;
  openedAt: string;
  closedAt: string | null;
}

export interface IncidentListRecord {
  id: string;
  status: "open" | "closed";
  title: string;
  body: string | null;
  openedAt: string;
  closedAt: string | null;
  monitorId: string;
  monitorName: string;
  monitorKind: MonitorKind;
  monitorLastStatus: MonitorStatus;
}

export interface IncidentListFilters {
  status: "open" | "closed" | "all";
  monitorId?: string;
  query?: string;
}

export interface StatusPageRecord {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  published: number;
  showHistory: number;
  showTarget: number;
  createdAt: string;
  updatedAt: string;
}

export type NotificationProvider = "discord" | "webhook" | "telegram";

export interface NotificationHeader {
  key: string;
  value: string;
}

export interface DiscordNotificationConfig {
  webhookUrl: string;
}

export interface WebhookNotificationConfig {
  url: string;
  headers?: NotificationHeader[];
}

export interface TelegramNotificationConfig {
  botToken: string;
  chatId: string;
  messageThreadId?: string | null;
}

export type NotificationDestinationConfig =
  | DiscordNotificationConfig
  | WebhookNotificationConfig
  | TelegramNotificationConfig;

export interface NotificationDestinationRecord {
  id: string;
  name: string;
  provider: NotificationProvider;
  configJson: string;
  config: NotificationDestinationConfig;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDestinationMonitorSummary {
  id: string;
  name: string;
  kind: MonitorKind;
}

export interface NotificationDestinationListItem extends NotificationDestinationRecord {
  monitorCount: number;
  assignedMonitors: NotificationDestinationMonitorSummary[];
}

export interface NotificationDestinationDetail extends NotificationDestinationRecord {
  monitorIds: string[];
}

export interface AppSettingsRecord {
  id: string;
  heartbeatRetentionDays: number;
  incidentRetentionDays: number;
  updatedAt: string;
}

export interface AccountData {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    role: "admin" | "user";
    createdAt: string;
    updatedAt: string;
  };
  accounts: {
    id: string;
    providerId: string;
    accountId: string;
    createdAt: string;
    updatedAt: string;
  }[];
  sessions: {
    id: string;
    expiresAt: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
}

export interface MonitorCheckResult {
  status: MonitorStatus;
  statusCode: number | null;
  durationMs: number;
  error: string | null;
  details?: string | null;
  responseText?: string;
}

export interface SummarySnapshot {
  generatedAt: string;
  status: MonitorStatus;
  monitorCounts: Record<MonitorStatus, number>;
  openIncidentCount: number;
  recentHeartbeats: HeartbeatRecord[];
  monitors: MonitorRecord[];
  incidents: IncidentRecord[];
}

export interface MonitorAvailabilityWindow {
  label: string;
  uptimePercentage: number | null;
  totalChecks: number;
  upChecks: number;
}

export interface MonitorDetailMetrics {
  windows: MonitorAvailabilityWindow[];
  requestCount: number;
  averageResponseMs: number | null;
  p50ResponseMs: number | null;
  p75ResponseMs: number | null;
  p90ResponseMs: number | null;
  p95ResponseMs: number | null;
  p99ResponseMs: number | null;
  mttrMinutes: number | null;
  lastCheckedAt: string | null;
}

export interface DashboardData {
  monitors: MonitorRecord[];
  incidents: IncidentRecord[];
  openIncidentCount: number;
  heartbeatCounts: {
    lastHour: number;
    lastDay: number;
  };
  heartbeats: HeartbeatRecord[];
  statusPages: StatusPageRecord[];
  counts: Record<MonitorStatus, number>;
  overallStatus: MonitorStatus;
}

export interface SettingsData {
  settings: AppSettingsRecord;
  monitors: MonitorRecord[];
  openIncidentCount: number;
  statusPages: StatusPageRecord[];
  statusPageLinks: Array<{ status_page_id: string; monitor_id: string }>;
  notificationDestinations: NotificationDestinationRecord[];
}

export interface MonitorListData {
  monitors: MonitorRecord[];
  notificationDestinations: NotificationDestinationRecord[];
  openIncidentCount: number;
  slowestP95ResponseMs: number | null;
}

export interface MonitorDetailData {
  monitor: MonitorRecord;
  incidents: IncidentRecord[];
  heartbeats: HeartbeatRecord[];
  metrics: MonitorDetailMetrics;
  notificationDestinations: NotificationDestinationRecord[];
  notificationDestinationIds: string[];
}

export interface StatusPagesData {
  pages: StatusPageRecord[];
  monitors: MonitorRecord[];
  links: Array<{ status_page_id: string; monitor_id: string }>;
}

export interface StatusPageDetailData {
  page: StatusPageRecord;
  monitorIds: string[];
  monitors: MonitorRecord[];
}

export interface PublicStatusPageData {
  page: StatusPageRecord;
  monitors: MonitorRecord[];
  incidents: IncidentRecord[];
  heartbeats: HeartbeatRecord[];
  historyDays: number;
  status: MonitorStatus;
}

export interface SessionData {
  user: {
    id: string | null;
    name: string | null;
    email: string | null;
    image: string | null;
    role: string | null;
  } | null;
}
