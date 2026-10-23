import "@tanstack/react-start/server-only";
import type { Heartbeat } from "@/lib/schemas/monitors";

/** Pure aggregation of check history into the numbers the UI shows. */

type IncidentSpan = {
  readonly openedAt: string;
  readonly closedAt: string | null;
};

export function slowestP95ResponseMs(
  durations: ReadonlyArray<{ monitorId: string; durationMs: number | null }>,
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

export function monitorMetrics(
  heartbeats: ReadonlyArray<Heartbeat>,
  incidents: ReadonlyArray<IncidentSpan>,
  counts: {
    readonly requestCount: number;
    readonly windows: ReadonlyArray<{
      days: number;
      totalChecks: number;
      upChecks: number;
    }>;
  },
  monitorLastCheckedAt: string | null,
) {
  const windows = counts.windows.map(({ days, totalChecks, upChecks }) => ({
    days,
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
    lastCheckedAt: monitorLastCheckedAt ?? latestCheckedAt(heartbeats),
  };
}

/** Heartbeats arrive newest first; an empty history has no last check. */
function latestCheckedAt(heartbeats: ReadonlyArray<Heartbeat>): string | null {
  return heartbeats.length > 0 ? heartbeats[0].createdAt : null;
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

function computeMttrMinutes(incidents: ReadonlyArray<IncidentSpan>) {
  const durations = incidents.flatMap((incident) => {
    if (!hasClosedAt(incident)) return [];

    const duration =
      (Date.parse(incident.closedAt) - Date.parse(incident.openedAt)) / 60000;

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
  incident: IncidentSpan,
): incident is IncidentSpan & { closedAt: string } {
  return incident.closedAt != null;
}

function isSuccessfulHeartbeat(
  heartbeat: Heartbeat,
): heartbeat is Heartbeat & { durationMs: number } {
  return heartbeat.status === "up" && heartbeat.durationMs != null;
}

function roundTo(value: number, digits = 2) {
  const factor = 10 ** digits;

  return Math.round(value * factor) / factor;
}
