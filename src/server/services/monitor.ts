import { all } from "better-all";

import type { Database } from "@/server/db";
import type {
  HeartbeatRecord,
  IncidentRecord,
  MonitorDetailData,
  MonitorListData,
} from "@/types";

import {
  clampMonitorLogsPage,
  MONITOR_LOGS_PAGE_SIZE,
} from "@/lib/monitor/logs";
import { daysAgoIso, hoursAgoIso, parseDateMs } from "@/server/lib/dates";

type CachedMetrics = {
  expiresAt: number;
  data: Awaited<ReturnType<Database["monitor"]["getHeartbeatMetricCounts"]>>;
};

const metricCountsCache = new Map<string, CachedMetrics>();

const METRICS_CACHE_TTL_MS = 60_000;

export function clearMetricCountsCache(monitorId?: string) {
  if (monitorId) {
    metricCountsCache.delete(monitorId);
  } else {
    metricCountsCache.clear();
  }
}

export class MonitorService {
  constructor(private readonly db: Database) {}

  async getListData() {
    const { monitors, notificationDestinations, openIncidentCount, durations } =
      await all({
        monitors: () => this.db.monitor.listByName(),
        notificationDestinations: () => this.db.notification.list(),
        openIncidentCount: () => this.db.incident.countOpen(),
        durations: () => this.db.monitor.listSuccessfulDurations(200),
      });

    return {
      monitors,
      notificationDestinations,
      openIncidentCount,
      slowestP95ResponseMs: computeSlowestP95ResponseMs(durations),
    } satisfies MonitorListData;
  }

  async getDetailData(monitorId: string) {
    const monitor = await this.db.monitor.getById(monitorId);

    if (!monitor) {
      return null;
    }

    const cutoff = hoursAgoIso(49);

    const {
      incidents,
      recentHeartbeats,
      heartbeatMetricCounts,
      notificationDestinations,
    } = await all({
      incidents: () => this.db.incident.listForMonitor(monitorId, 50),
      recentHeartbeats: () =>
        this.db.monitor.listHeartbeatsSince(monitorId, cutoff),
      heartbeatMetricCounts: async () => {
        const cached = metricCountsCache.get(monitorId);
        const now = Date.now();

        if (cached && cached.expiresAt > now) {
          return cached.data;
        }

        const fresh = await this.db.monitor.getHeartbeatMetricCounts(
          monitorId,
          {
            last7Days: daysAgoIso(6),
            last30Days: daysAgoIso(29),
            last365Days: daysAgoIso(364),
          },
        );

        metricCountsCache.set(monitorId, {
          expiresAt: now + METRICS_CACHE_TTL_MS,
          data: fresh,
        });

        return fresh;
      },
      notificationDestinations: () =>
        this.db.notification.getForMonitor(monitorId),
    });

    const heartbeats =
      recentHeartbeats.length > 0
        ? recentHeartbeats
        : await this.db.monitor.listHeartbeats(monitorId, 100);

    return {
      monitor,
      incidents,
      heartbeats,
      metrics: computeMonitorDetailMetrics(
        heartbeats,
        incidents,
        heartbeatMetricCounts,
        monitor.lastCheckedAt,
      ),
      notificationDestinations,
      notificationDestinationIds: notificationDestinations.map(
        (destination) => destination.id,
      ),
    } satisfies MonitorDetailData;
  }

  async getHeartbeatPage(monitorId: string, pageInput: number) {
    const monitor = await this.db.monitor.getById(monitorId);

    if (!monitor) {
      return null;
    }

    const total = await this.db.monitor.countHeartbeats(monitorId);

    const totalPages =
      total === 0 ? 0 : Math.ceil(total / MONITOR_LOGS_PAGE_SIZE);

    const page = clampMonitorLogsPage(pageInput, totalPages);
    const offset = (page - 1) * MONITOR_LOGS_PAGE_SIZE;

    const rows =
      total === 0
        ? []
        : await this.db.monitor.listHeartbeatPage(
            monitorId,
            MONITOR_LOGS_PAGE_SIZE,
            offset,
          );

    return {
      heartbeats: rows,
      page,
      pageSize: MONITOR_LOGS_PAGE_SIZE,
      total,
      totalPages,
      hasPreviousPage: page > 1 && totalPages > 0,
      hasNextPage: totalPages > 0 && page < totalPages,
    };
  }
}

function computeSlowestP95ResponseMs(
  durations: Array<{ monitorId: string; durationMs: number | null }>,
) {
  const byMonitor = new Map<string, number[]>();

  for (const row of durations) {
    if (row.durationMs == null) {
      continue;
    }

    const monitorDurations = byMonitor.get(row.monitorId);

    if (monitorDurations) {
      monitorDurations.push(row.durationMs);
    } else {
      byMonitor.set(row.monitorId, [row.durationMs]);
    }
  }

  let slowest: number | null = null;

  for (const values of byMonitor.values()) {
    const p95 = percentile(
      values.sort((left, right) => left - right),
      0.95,
    );

    if (p95 != null && (slowest == null || p95 > slowest)) {
      slowest = p95;
    }
  }

  return slowest;
}

function computeMonitorDetailMetrics(
  heartbeats: HeartbeatRecord[],
  incidents: IncidentRecord[],
  counts: {
    requestCount: number;
    windows: Array<{ days: number; totalChecks: number; upChecks: number }>;
  },
  monitorLastCheckedAt?: string | null,
) {
  const windows = counts.windows.map(({ days, totalChecks, upChecks }) => ({
    label: `Last ${days} days`,
    uptimePercentage: totalChecks
      ? roundTo((upChecks / totalChecks) * 100)
      : null,
    totalChecks,
    upChecks,
  }));

  const successfulDurations = heartbeats
    .flatMap((heartbeat) =>
      isSuccessfulHeartbeat(heartbeat) ? [heartbeat.durationMs] : [],
    )
    .sort((left, right) => left - right);

  return {
    windows,
    requestCount: counts.requestCount,
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
    lastCheckedAt: monitorLastCheckedAt ?? heartbeats[0]?.createdAt ?? null,
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
  const durations = incidents.flatMap((incident) => {
    if (!hasClosedAt(incident)) return [];

    const duration =
      (parseDateMs(incident.closedAt) - parseDateMs(incident.openedAt)) / 60000;

    return Number.isFinite(duration) && duration >= 0 ? [duration] : [];
  });

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
