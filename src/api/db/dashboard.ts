import { all } from "better-all";
import { asc, desc, eq, gte, sql } from "drizzle-orm";

import type {
  AppSettingsRecord,
  DashboardData,
  MonitorStatus,
  SettingsData,
  SummarySnapshot,
} from "@/types";

import { schema, type AppDrizzleDb } from "@/api/db";
import {
  mapHeartbeatRecord,
  mapIncidentRecord,
  mapMonitorRecord,
  mapNotificationDestinationRecord,
  mapStatusPageRecord,
} from "@/api/db/normalize";
import { daysAgoIso, hoursAgoIso, nowIso } from "@/api/lib/dates";
import { computeAggregateStatus } from "@/api/lib/monitoring";

const APP_SETTINGS_ID = "default";
const RECENT_DASHBOARD_HEARTBEAT_LIMIT = 10;
type AppSettingsRow = typeof schema.appSettings.$inferSelect;

export class DashboardReader {
  constructor(private readonly db: AppDrizzleDb) {}

  async getOverview() {
    const {
      monitors,
      incidents,
      openIncidentCount,
      heartbeatCountLastHour,
      heartbeatCountLastDay,
      heartbeats,
      statusPages,
    } = await all({
      monitors: () => this.listMonitors(),
      incidents: () => this.listRecentIncidents(),
      openIncidentCount: () => this.countOpenIncidents(),
      heartbeatCountLastHour: () => this.countHeartbeatsSince(hoursAgoIso(1)),
      heartbeatCountLastDay: () => this.countHeartbeatsSince(daysAgoIso(1)),
      heartbeats: () =>
        this.listRecentHeartbeats(RECENT_DASHBOARD_HEARTBEAT_LIMIT),
      statusPages: () => this.listStatusPages(),
    });

    const counts = countStatuses(monitors.map((monitor) => monitor.lastStatus));
    return {
      monitors,
      incidents,
      openIncidentCount,
      heartbeatCounts: {
        lastHour: heartbeatCountLastHour,
        lastDay: heartbeatCountLastDay,
      },
      heartbeats,
      statusPages,
      counts,
      overallStatus: computeAggregateStatus(
        monitors.map((monitor) => monitor.lastStatus),
      ),
    } satisfies DashboardData;
  }

  async getSettings() {
    const {
      settings,
      monitors,
      openIncidentCount,
      statusPages,
      statusPageLinks,
      notificationDestinations,
    } = await all({
      settings: () => this.getAppSettings(),
      monitors: () => this.listMonitors(),
      openIncidentCount: () => this.countOpenIncidents(),
      statusPages: () => this.listStatusPages(),
      statusPageLinks: () => this.listStatusPageLinks(),
      notificationDestinations: () => this.listNotificationDestinations(),
    });

    return {
      settings,
      monitors,
      openIncidentCount,
      statusPages,
      statusPageLinks,
      notificationDestinations,
    } satisfies SettingsData;
  }

  async getSummarySnapshot() {
    const dashboard = await this.getOverview();
    return {
      generatedAt: nowIso(),
      status: dashboard.overallStatus,
      monitorCounts: dashboard.counts,
      openIncidentCount: dashboard.openIncidentCount,
      recentHeartbeats: dashboard.heartbeats,
      monitors: dashboard.monitors,
      incidents: dashboard.incidents,
    } satisfies SummarySnapshot;
  }

  async listMonitors() {
    const rows = await this.db
      .select()
      .from(schema.monitors)
      .orderBy(asc(schema.monitors.name));
    return rows.map(mapMonitorRecord);
  }

  async listStatusPages() {
    const rows = await this.db
      .select()
      .from(schema.statusPages)
      .orderBy(asc(schema.statusPages.createdAt));
    return rows.map(mapStatusPageRecord);
  }

  async listStatusPageLinks() {
    const rows = await this.db.select().from(schema.statusPageMonitors);
    return rows.map((link) => ({
      status_page_id: link.statusPageId,
      monitor_id: link.monitorId,
    }));
  }

  async getAppSettings() {
    const existing = await this.db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.id, APP_SETTINGS_ID))
      .get();
    if (existing) {
      return mapAppSettingsRecord(existing);
    }

    const now = nowIso();
    await this.db.insert(schema.appSettings).values({
      id: APP_SETTINGS_ID,
      heartbeatRetentionDays: 30,
      incidentRetentionDays: 90,
      updatedAt: now,
    });

    return mapAppSettingsRecord({
      id: APP_SETTINGS_ID,
      heartbeatRetentionDays: 30,
      incidentRetentionDays: 90,
      updatedAt: now,
    });
  }

  private async listRecentIncidents() {
    const rows = await this.db
      .select()
      .from(schema.incidents)
      .orderBy(
        sql`CASE ${schema.incidents.status} WHEN 'open' THEN 0 ELSE 1 END`,
        desc(schema.incidents.openedAt),
      )
      .limit(12);
    return rows.map(mapIncidentRecord);
  }

  private async countOpenIncidents() {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.incidents)
      .where(eq(schema.incidents.status, "open"));
    return rows[0]?.count ?? 0;
  }

  private async countHeartbeatsSince(cutoff: string) {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.heartbeats)
      .where(gte(schema.heartbeats.createdAt, cutoff));
    return rows[0]?.count ?? 0;
  }

  private async listRecentHeartbeats(limit: number) {
    const rows = await this.db
      .select()
      .from(schema.heartbeats)
      .orderBy(desc(schema.heartbeats.createdAt))
      .limit(limit);
    return rows.map(mapHeartbeatRecord);
  }

  private async listNotificationDestinations() {
    const rows = await this.db
      .select()
      .from(schema.notificationDestinations)
      .orderBy(desc(schema.notificationDestinations.createdAt));
    return rows.map(mapNotificationDestinationRecord);
  }
}

function mapAppSettingsRecord(row: AppSettingsRow) {
  return {
    id: row.id,
    heartbeatRetentionDays: row.heartbeatRetentionDays,
    incidentRetentionDays: row.incidentRetentionDays,
    updatedAt: row.updatedAt,
  } satisfies AppSettingsRecord;
}

function countStatuses(statuses: MonitorStatus[]) {
  return statuses.reduce<Record<MonitorStatus, number>>(
    (counts, status) => {
      counts[status] += 1;
      return counts;
    },
    { up: 0, down: 0, unknown: 0 },
  );
}
