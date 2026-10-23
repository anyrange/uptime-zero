import "@tanstack/react-start/server-only";
import { notFound } from "@tanstack/react-router";
import dayjs from "dayjs";
import { logger } from "void/log";

import type { Monitor } from "@/lib/schemas/monitors";

import { AppError } from "@/lib/errors";
import {
  clampMonitorLogsPage,
  MONITOR_LOGS_PAGE_SIZE,
} from "@/lib/monitor-logs";
import {
  type MonitorConfig,
  type MonitorExport,
  type MonitorExportInput,
  normalizeMonitorConfig,
} from "@/lib/schemas/monitor-config";
import * as incidents from "@/modules/incidents/incidents.service";
import * as notifications from "@/modules/notifications/notifications.service";
import { m } from "@/paraglide/messages.js";

import { monitorMetrics, slowestP95ResponseMs } from "./metrics";
import * as repo from "./monitors.repository";
import { probe } from "./probe";
import {
  cronHeartbeatSchedule,
  isDue,
  nextCronRunAt,
  nextDueAt,
} from "./schedule";

/**
 * Monitor use cases: configuring monitors, reading their history, and the
 * check lifecycle the scheduler and push endpoint drive.
 */

const DETAIL_WINDOW_HOURS = 49;

const DETAIL_FALLBACK_HEARTBEATS = 100;

const DETAIL_MAX_HEARTBEATS = 6000;

const P95_SAMPLE_SIZE = 200;

const FAILED_CHECK_RETRY_DELAY_MS = 30_000;

export const all = repo.list;

export async function list() {
  const [monitors, { destinations }, durations] = await Promise.all([
    repo.list(),
    notifications.list(),
    repo.listSuccessfulDurations(P95_SAMPLE_SIZE),
  ]);

  return {
    monitors,
    notificationDestinations: destinations,
    slowestP95ResponseMs: slowestP95ResponseMs(durations),
  };
}

export async function get(id: string) {
  return orNotFound(await repo.findById(id));
}

export async function detail(id: string) {
  const monitor = await get(id);
  const since = dayjs().subtract(DETAIL_WINDOW_HOURS, "hour").toISOString();

  const [monitorIncidents, recent, counts, notificationDestinations] =
    await Promise.all([
      incidents.forMonitor(id),
      repo.listHeartbeats(id, { since, limit: DETAIL_MAX_HEARTBEATS }),
      cachedForAMinute(`availability:${id}`, () =>
        repo.availabilityCounts(id, {
          last7Days: dayjs().subtract(6, "day").toISOString(),
          last30Days: dayjs().subtract(29, "day").toISOString(),
          last365Days: dayjs().subtract(364, "day").toISOString(),
        }),
      ),
      notifications.forMonitor(id),
    ]);

  // Quiet monitors still show their latest checks.
  const heartbeats =
    recent.length > 0
      ? recent
      : await repo.listHeartbeats(id, { limit: DETAIL_FALLBACK_HEARTBEATS });

  return {
    monitor,
    incidents: monitorIncidents,
    heartbeats,
    metrics: monitorMetrics(
      heartbeats,
      monitorIncidents,
      counts,
      monitor.lastCheckedAt,
    ),
    notificationDestinations,
  };
}

export async function logs(id: string, requestedPage: number) {
  await get(id);

  const total = await repo.countHeartbeats(id);
  const totalPages = Math.ceil(total / MONITOR_LOGS_PAGE_SIZE);
  const page = clampMonitorLogsPage(requestedPage, totalPages);

  const heartbeats =
    total === 0
      ? []
      : await repo.listHeartbeatPage(
          id,
          MONITOR_LOGS_PAGE_SIZE,
          (page - 1) * MONITOR_LOGS_PAGE_SIZE,
        );

  return {
    heartbeats,
    page,
    pageSize: MONITOR_LOGS_PAGE_SIZE,
    total,
    totalPages,
    hasPreviousPage: page > 1 && totalPages > 0,
    hasNextPage: totalPages > 0 && page < totalPages,
  };
}

export function recentHeartbeats() {
  return repo.listRecentHeartbeats(10);
}

export function recentHeartbeatCounts() {
  return cachedForAMinute("recent-heartbeat-counts", () =>
    repo.countRecentHeartbeats({
      hour: dayjs().subtract(1, "hour").toISOString(),
      day: dayjs().subtract(0, "day").toISOString(),
    }),
  );
}

/** Saves a monitor; an active poll monitor runs its first check right away. */
export async function create(config: MonitorConfig) {
  const saved = await repo.insert(normalizeMonitorConfig(config));

  if (!saved) throw new Error("inserted monitor was not found");

  // The detail page then opens with real data; the per-minute cron runs
  // every later check.
  if (saved.active && saved.kind !== "push") await runCheck(saved);

  return saved;
}

export async function update(id: string, config: MonitorConfig) {
  const existing = await get(id);

  return orNotFound(
    await repo.update(existing, normalizeMonitorConfig(config)),
  );
}

export const remove = repo.remove;

export async function setActive(id: string, active: boolean) {
  return orNotFound(await repo.setActive(id, active));
}

export async function rotatePushToken(id: string) {
  return orNotFound(await repo.rotatePushToken(id));
}

/** Probes an unsaved configuration without persisting anything. */
export async function test(config: MonitorConfig) {
  if (config.kind === "push") {
    throw new AppError(m.monitor_test_push_unavailable());
  }

  return probe(normalizeMonitorConfig(config));
}

export async function exportConfig() {
  const monitors = await repo.list();

  return {
    kind: "uptime-monitor-export" as const,
    version: 1 as const,
    exportedAt: dayjs().toISOString(),
    monitors: monitors.map((monitor) => ({
      name: monitor.name,
      kind: monitor.kind,
      target: monitor.target,
      intervalSec: monitor.intervalSec,
      timeoutMs: monitor.timeoutMs,
      retries: monitor.retries,
      assertions: monitor.assertions,
      heartbeatMode: monitor.heartbeatMode,
      heartbeatCron: monitor.heartbeatCron,
      heartbeatGraceSec: monitor.heartbeatGraceSec,
      heartbeatTimezone: monitor.heartbeatTimezone,
      notificationGraceSec: monitor.notificationGraceSec,
      active: monitor.active,
      notificationDestinationIds: [],
    })),
  } satisfies MonitorExportInput;
}

/** Imports monitors as new rows with fresh ids and push tokens. */
export async function importConfig(file: MonitorExport) {
  const saved: Monitor[] = [];

  for (const config of file.monitors) {
    const monitor = await repo.insert(normalizeMonitorConfig(config));

    if (monitor) saved.push(monitor);
  }

  return saved;
}

/** Active monitors due for a check, earliest first. */
export async function due() {
  const now = Date.now();
  const active = await repo.listActive();

  const dueMonitors = active.filter((monitor) => {
    try {
      return isDue(monitor, now);
    } catch (error) {
      logger.error("invalid monitor schedule", {
        monitorId: monitor.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return false;
    }
  });

  return dueMonitors.sort((left, right) => nextDueAt(left) - nextDueAt(right));
}

export type ScheduledCheckOutcome = "checked" | "skipped" | "failed";

/**
 * Runs one scheduled check. State is re-read because it may have changed
 * since the due list was built. Overlapping runs are harmless: `recordCheck`
 * only accepts a result for the revision it ran against. A check that fails
 * before it is recorded backs off so it cannot starve the monitors behind
 * it.
 */
export async function runScheduledCheck(
  id: string,
): Promise<ScheduledCheckOutcome> {
  const monitor = await repo.findById(id);
  const now = Date.now();

  if (!monitor?.active || !isDue(monitor, now)) return "skipped";

  try {
    await runCheck(monitor);

    return "checked";
  } catch (error) {
    await repo.setRetryAt(id, now + FAILED_CHECK_RETRY_DELAY_MS);

    logger.error("monitor check failed before it was recorded", {
      monitorId: id,
      error: error instanceof Error ? error.stack : String(error),
    });

    return "failed";
  }
}

/**
 * Records a push heartbeat for the monitor behind `token`, or returns null
 * when no monitor has it. Paused monitors ignore the heartbeat.
 */
export async function recordHeartbeat(token: string) {
  const monitor = await repo.findByPushToken(token);

  if (!monitor) return null;

  if (monitor.active) {
    await repo.recordCheck(
      monitor,
      { status: "up", statusCode: 200, durationMs: 0, error: null },
      "push",
      dayjs().toISOString(),
    );
  }

  return monitor;
}

function orNotFound<A>(value: A | null): A {
  if (value === null) throw notFound();

  return value;
}

/** Probes or, for push monitors, records the missed heartbeat. */
async function runCheck(monitor: Monitor) {
  if (monitor.kind === "push") {
    await repo.recordCheck(
      monitor,
      {
        status: "down",
        statusCode: null,
        durationMs: 0,
        error: missedHeartbeatMessage(monitor),
      },
      "system",
      dayjs().toISOString(),
    );

    return;
  }

  const result = await probe(monitor);

  await repo.recordCheck(monitor, result, "poll", dayjs().toISOString());
}

function missedHeartbeatMessage(monitor: Monitor) {
  if (monitor.heartbeatMode !== "cron") {
    return `No heartbeat received in the last ${monitor.intervalSec}s`;
  }

  const baseline = Date.parse(monitor.lastCheckedAt ?? monitor.createdAt);
  const expectedAt = nextCronRunAt(monitor, baseline);
  const { graceSec } = cronHeartbeatSchedule(monitor);

  return `No heartbeat received for the ${new Date(expectedAt).toISOString()} schedule within ${graceSec}s`;
}

// History aggregates scan many rows and change slowly, so each isolate reuses
// them for a minute. Only settled values are shared: a pending promise from
// one request must never be awaited by another on Workers.
const STATS_TTL_MS = 60_000;

const MAX_CACHE_ENTRIES = 256;

const statsCache = new Map<string, { expiresAt: number; value: unknown }>();

async function cachedForAMinute<A>(key: string, lookup: () => Promise<A>) {
  const now = Date.now();
  const hit = statsCache.get(key);

  if (hit && hit.expiresAt > now) {
    // SAFETY: each key is only ever written by the lookup typed `A` below.
    return hit.value as A;
  }

  const value = await lookup();

  if (statsCache.size >= MAX_CACHE_ENTRIES) statsCache.clear();

  statsCache.set(key, { expiresAt: now + STATS_TTL_MS, value });

  return value;
}
