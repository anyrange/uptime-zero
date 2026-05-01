import { all } from "better-all";
import { asc, desc, eq, gte, sql } from "drizzle-orm";

import type {
  AppSettingsRecord,
  DashboardData,
  MonitorStatus,
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
type AppSettingsRow = typeof schema.appSettings.$inferSelect;

export class DashboardModel {
  constructor(private readonly db: AppDrizzleDb) {}

  async get() {
    const {
      settings,
      monitors,
      incidents,
      openIncidentCount,
      heartbeatCountLastHour,
      heartbeatCountLastDay,
      heartbeats,
      statusPages,
      statusPageLinks,
      notificationDestinations,
    } = await all({
      settings: () => this.getAppSettings(),
      monitors: () =>
        this.db
          .select()
          .from(schema.monitors)
          .orderBy(asc(schema.monitors.name)),
      incidents: () =>
        this.db
          .select()
          .from(schema.incidents)
          .orderBy(
            sql`CASE ${schema.incidents.status} WHEN 'open' THEN 0 ELSE 1 END`,
            desc(schema.incidents.openedAt),
          )
          .limit(12),
      openIncidentCount: () =>
        this.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.incidents)
          .where(eq(schema.incidents.status, "open")),
      heartbeatCountLastHour: () =>
        this.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.heartbeats)
          .where(gte(schema.heartbeats.createdAt, hoursAgoIso(1))),
      heartbeatCountLastDay: () =>
        this.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.heartbeats)
          .where(gte(schema.heartbeats.createdAt, daysAgoIso(1))),
      heartbeats: () =>
        this.db
          .select()
          .from(schema.heartbeats)
          .orderBy(desc(schema.heartbeats.createdAt))
          .limit(200),
      statusPages: () =>
        this.db
          .select()
          .from(schema.statusPages)
          .orderBy(asc(schema.statusPages.createdAt)),
      statusPageLinks: () => this.db.select().from(schema.statusPageMonitors),
      notificationDestinations: () => this.listNotificationDestinations(),
    });

    const mappedMonitors = monitors.map(mapMonitorRecord);
    const counts = countStatuses(
      mappedMonitors.map((monitor) => monitor.lastStatus),
    );
    return {
      settings,
      monitors: mappedMonitors,
      incidents: incidents.map(mapIncidentRecord),
      openIncidentCount: openIncidentCount[0]?.count ?? 0,
      heartbeatCounts: {
        lastHour: heartbeatCountLastHour[0]?.count ?? 0,
        lastDay: heartbeatCountLastDay[0]?.count ?? 0,
      },
      heartbeats: heartbeats.map(mapHeartbeatRecord),
      statusPages: statusPages.map(mapStatusPageRecord),
      statusPageLinks: statusPageLinks.map((link) => ({
        status_page_id: link.statusPageId,
        monitor_id: link.monitorId,
      })),
      notificationDestinations,
      counts,
      overallStatus: computeAggregateStatus(
        mappedMonitors.map((monitor) => monitor.lastStatus),
      ),
    } satisfies DashboardData;
  }

  async getSummarySnapshot() {
    const dashboard = await this.get();
    return {
      generatedAt: nowIso(),
      status: dashboard.overallStatus,
      monitorCounts: dashboard.counts,
      openIncidentCount: dashboard.openIncidentCount,
      recentHeartbeats: dashboard.heartbeats.slice(0, 10),
      monitors: dashboard.monitors,
      incidents: dashboard.incidents,
    } satisfies SummarySnapshot;
  }

  private async getAppSettings() {
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

  private async listNotificationDestinations() {
    const destinations = await this.db
      .select()
      .from(schema.notificationDestinations)
      .orderBy(desc(schema.notificationDestinations.createdAt));
    return destinations.map(mapNotificationDestinationRecord);
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
