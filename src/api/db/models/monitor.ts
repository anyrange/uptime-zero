import { all } from "better-all";
import { asc, desc, eq, sql } from "drizzle-orm";

import type {
  HeartbeatPage,
  HeartbeatRecord,
  IncidentRecord,
  MonitorDetailData,
  MonitorRecord,
} from "@/types";

import { schema, type AppDrizzleDb } from "@/api/db";
import {
  mapHeartbeatRecord,
  mapIncidentRecord,
  mapMonitorRecord,
  mapNotificationDestinationRecord,
  normalizeMonitorKind,
} from "@/api/db/normalize";
import { daysAgoMs, nowIso, parseDateMs } from "@/api/lib/dates";
import { normalizeMonitorAssertions } from "@/lib/monitor-assertions";
import {
  clampMonitorLogsPage,
  MONITOR_LOGS_PAGE_SIZE,
  normalizeMonitorLogsPage,
} from "@/lib/monitor-logs";

export class MonitorModel {
  constructor(private readonly db: AppDrizzleDb) {}

  async createOrUpdate(
    payload: Partial<MonitorRecord> & {
      id?: string;
      notificationDestinationIds?: string[];
    },
  ) {
    const now = nowIso();
    const id = payload.id ?? crypto.randomUUID();
    const existing = payload.id
      ? await this.db
          .select()
          .from(schema.monitors)
          .where(eq(schema.monitors.id, payload.id))
          .get()
      : null;
    const kind = normalizeMonitorKind(payload.kind ?? existing?.kind ?? "http");
    const assertions = normalizeMonitorAssertions(
      payload.assertions ?? existing?.assertionsJson ?? null,
    );
    const pushToken =
      kind === "push"
        ? (existing?.pushToken ?? payload.pushToken ?? crypto.randomUUID())
        : null;

    if (existing) {
      await this.db
        .update(schema.monitors)
        .set({
          name: payload.name ?? existing.name,
          kind,
          target: payload.target ?? existing.target,
          intervalSec: payload.intervalSec ?? existing.intervalSec,
          timeoutMs: payload.timeoutMs ?? existing.timeoutMs,
          retries: payload.retries ?? existing.retries,
          assertionsJson: JSON.stringify(assertions),
          pushToken,
          active: payload.active ?? existing.active,
          updatedAt: now,
        })
        .where(eq(schema.monitors.id, id));
    } else {
      await this.db.insert(schema.monitors).values({
        id,
        name: payload.name ?? "New monitor",
        kind,
        target: payload.target ?? "",
        intervalSec: payload.intervalSec ?? 60,
        timeoutMs: payload.timeoutMs ?? 10_000,
        retries: payload.retries ?? 0,
        assertionsJson: JSON.stringify(assertions),
        pushToken,
        active: payload.active ?? 1,
        lastStatus: "unknown",
        lastCheckedAt: null,
        lastDurationMs: null,
        lastError: null,
        lastCertValidTo: null,
        lastCertDaysRemaining: null,
        lastCertHostname: null,
        lastSslStatus: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (payload.notificationDestinationIds) {
      await this.replaceNotificationDestinationBindings(
        id,
        payload.notificationDestinationIds,
      );
    }

    const monitor = await this.db
      .select()
      .from(schema.monitors)
      .where(eq(schema.monitors.id, id))
      .get();
    return monitor ? mapMonitorRecord(monitor) : null;
  }

  async getById(id: string) {
    const monitor = await this.db
      .select()
      .from(schema.monitors)
      .where(eq(schema.monitors.id, id))
      .get();
    return monitor ? mapMonitorRecord(monitor) : null;
  }

  async listActiveIds() {
    const rows = await this.db
      .select({ id: schema.monitors.id })
      .from(schema.monitors)
      .where(eq(schema.monitors.active, 1))
      .orderBy(asc(schema.monitors.createdAt));
    return rows.map((row) => row.id);
  }

  async getByPushToken(token: string) {
    const monitor = await this.db
      .select()
      .from(schema.monitors)
      .where(eq(schema.monitors.pushToken, token))
      .get();
    return monitor ? mapMonitorRecord(monitor) : null;
  }

  delete(id: string) {
    return this.db.delete(schema.monitors).where(eq(schema.monitors.id, id));
  }

  async getDetailData(monitorId: string) {
    const monitor = await this.db
      .select()
      .from(schema.monitors)
      .where(eq(schema.monitors.id, monitorId))
      .get();
    if (!monitor) {
      return null;
    }

    const { incidents, heartbeats, notificationDestinations } = await all({
      incidents: () =>
        this.db
          .select()
          .from(schema.incidents)
          .where(eq(schema.incidents.monitorId, monitorId))
          .orderBy(desc(schema.incidents.openedAt))
          .limit(50),
      heartbeats: () =>
        this.db
          .select()
          .from(schema.heartbeats)
          .where(eq(schema.heartbeats.monitorId, monitorId))
          .orderBy(desc(schema.heartbeats.createdAt))
          .limit(1000),
      notificationDestinations: () =>
        this.getNotificationDestinationsForMonitor(monitorId),
    });

    const mappedMonitor = mapMonitorRecord(monitor);
    const mappedIncidents = incidents.map(mapIncidentRecord);
    const mappedHeartbeats = heartbeats.map(mapHeartbeatRecord);

    return {
      monitor: mappedMonitor,
      incidents: mappedIncidents,
      heartbeats: mappedHeartbeats,
      metrics: computeMonitorDetailMetrics(mappedHeartbeats, mappedIncidents),
      notificationDestinations,
      notificationDestinationIds: notificationDestinations.map(
        (destination) => destination.id,
      ),
    } satisfies MonitorDetailData;
  }

  async getHeartbeatPage(monitorId: string, pageInput: number) {
    const monitor = await this.db
      .select({ id: schema.monitors.id })
      .from(schema.monitors)
      .where(eq(schema.monitors.id, monitorId))
      .get();

    if (!monitor) {
      return null;
    }

    const requestedPage = normalizeMonitorLogsPage(pageInput);
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.heartbeats)
      .where(eq(schema.heartbeats.monitorId, monitorId));

    const total = count ?? 0;
    const totalPages =
      total === 0 ? 0 : Math.ceil(total / MONITOR_LOGS_PAGE_SIZE);
    const page = clampMonitorLogsPage(requestedPage, totalPages);
    const offset = (page - 1) * MONITOR_LOGS_PAGE_SIZE;
    const rows =
      total === 0
        ? []
        : await this.db
            .select()
            .from(schema.heartbeats)
            .where(eq(schema.heartbeats.monitorId, monitorId))
            .orderBy(desc(schema.heartbeats.createdAt))
            .limit(MONITOR_LOGS_PAGE_SIZE)
            .offset(offset);

    return {
      heartbeats: rows.map(mapHeartbeatRecord),
      page,
      pageSize: MONITOR_LOGS_PAGE_SIZE,
      total,
      totalPages,
      hasPreviousPage: page > 1 && totalPages > 0,
      hasNextPage: totalPages > 0 && page < totalPages,
    } satisfies HeartbeatPage;
  }

  private async replaceNotificationDestinationBindings(
    monitorId: string,
    notificationDestinationIds: string[],
  ) {
    const dedupedIds = [...new Set(notificationDestinationIds)];
    await this.db
      .delete(schema.monitorNotificationDestinations)
      .where(eq(schema.monitorNotificationDestinations.monitorId, monitorId));
    if (dedupedIds.length === 0) {
      return;
    }
    await this.db.insert(schema.monitorNotificationDestinations).values(
      dedupedIds.map((notificationDestinationId) => ({
        monitorId,
        notificationDestinationId,
      })),
    );
  }

  private async getNotificationDestinationsForMonitor(monitorId: string) {
    const rows = await this.db
      .select({
        id: schema.notificationDestinations.id,
        name: schema.notificationDestinations.name,
        provider: schema.notificationDestinations.provider,
        configJson: schema.notificationDestinations.configJson,
        createdAt: schema.notificationDestinations.createdAt,
        updatedAt: schema.notificationDestinations.updatedAt,
      })
      .from(schema.monitorNotificationDestinations)
      .innerJoin(
        schema.notificationDestinations,
        eq(
          schema.notificationDestinations.id,
          schema.monitorNotificationDestinations.notificationDestinationId,
        ),
      )
      .where(eq(schema.monitorNotificationDestinations.monitorId, monitorId))
      .orderBy(asc(schema.notificationDestinations.createdAt));

    return rows.map(mapNotificationDestinationRecord);
  }
}

function computeMonitorDetailMetrics(
  heartbeats: HeartbeatRecord[],
  incidents: IncidentRecord[],
) {
  const windows = [7, 30, 365].map((days) => ({
    label: `Last ${days} days`,
    ...computeUptimeWindow(heartbeats, days),
  }));
  const successfulDurations = heartbeats
    .filter(isSuccessfulHeartbeat)
    .map((heartbeat) => heartbeat.durationMs)
    .sort((left, right) => left - right);

  return {
    windows,
    requestCount: heartbeats.length,
    averageResponseMs: successfulDurations.length
      ? Math.round(
          successfulDurations.reduce((sum, duration) => sum + duration, 0) /
            successfulDurations.length,
        )
      : null,
    p50ResponseMs: percentile(successfulDurations, 0.5),
    p75ResponseMs: percentile(successfulDurations, 0.75),
    p90ResponseMs: percentile(successfulDurations, 0.9),
    p95ResponseMs: percentile(successfulDurations, 0.95),
    p99ResponseMs: percentile(successfulDurations, 0.99),
    mttrMinutes: computeMttrMinutes(incidents),
    lastCheckedAt: heartbeats[0]?.createdAt ?? null,
  };
}

function computeUptimeWindow(heartbeats: HeartbeatRecord[], days: number) {
  const cutoff = daysAgoMs(days);
  const relevant = heartbeats.filter(
    (heartbeat) => parseDateMs(heartbeat.createdAt) >= cutoff,
  );
  const upChecks = relevant.filter(
    (heartbeat) => heartbeat.status === "up",
  ).length;
  return {
    uptimePercentage: relevant.length
      ? roundTo((upChecks / relevant.length) * 100)
      : null,
    totalChecks: relevant.length,
    upChecks,
  };
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) {
    return null;
  }
  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.ceil(values.length * ratio) - 1),
  );
  return values[index] ?? null;
}

function computeMttrMinutes(incidents: IncidentRecord[]) {
  const durations = incidents
    .filter(hasClosedAt)
    .map(
      (incident) =>
        (parseDateMs(incident.closedAt) - parseDateMs(incident.openedAt)) /
        60000,
    )
    .filter((duration) => Number.isFinite(duration) && duration >= 0);
  if (durations.length === 0) {
    return null;
  }
  return roundTo(
    durations.reduce((sum, duration) => sum + duration, 0) / durations.length,
  );
}

function hasClosedAt(
  incident: IncidentRecord,
): incident is IncidentRecord & { closedAt: string } {
  return incident.closedAt != null;
}

function isSuccessfulHeartbeat(
  heartbeat: HeartbeatRecord,
): heartbeat is HeartbeatRecord & { durationMs: number } {
  return heartbeat.status === "up" && heartbeat.durationMs != null;
}

function roundTo(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
