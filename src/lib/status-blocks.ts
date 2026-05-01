import type {
  StatusBarData,
  StatusType,
} from "@/components/blocks/status.types";
import type { HeartbeatRecord, IncidentRecord, MonitorStatus } from "@/types";

import { m } from "@/paraglide/messages.js";

export function monitorStatusToBlockStatus(
  status: MonitorStatus,
): Exclude<StatusType, "empty"> {
  if (status === "up") {
    return "success";
  }
  if (status === "down") {
    return "error";
  }
  return "degraded";
}

export function formatMonitorUptime(heartbeats: HeartbeatRecord[]) {
  if (heartbeats.length === 0) {
    return m.common_no_data();
  }

  const upChecks = heartbeats.filter(
    (heartbeat) => heartbeat.status === "up",
  ).length;
  const percentage = (upChecks / heartbeats.length) * 100;
  return m.monitor_uptime_percent({ percent: percentage.toFixed(0) });
}

export function buildStatusBarData(
  heartbeats: HeartbeatRecord[],
  incidents: IncidentRecord[] = [],
  count = 24,
): StatusBarData[] {
  return heartbeats
    .slice(0, count)
    .reverse()
    .map((heartbeat) => {
      const heartbeatAt = new Date(heartbeat.createdAt);

      return {
        day: heartbeat.createdAt,
        bar: [
          { status: monitorStatusToBlockStatus(heartbeat.status), height: 100 },
        ],
        card: [
          {
            status: monitorStatusToBlockStatus(heartbeat.status),
            value:
              heartbeat.durationMs != null
                ? m.monitor_response_ms({ value: heartbeat.durationMs })
                : heartbeat.statusCode != null
                  ? m.monitor_http_status({ code: heartbeat.statusCode })
                  : heartbeat.error || m.common_no_details(),
          },
        ],
        events: incidents
          .filter((incident) =>
            incidentOverlapsHeartbeat(incident, heartbeatAt),
          )
          .map((incident, index) => ({
            id:
              Number.parseInt(incident.id.replace(/\D/g, "").slice(0, 9), 10) ||
              index + 1,
            name: incident.title,
            type: "incident" as const,
            from: new Date(incident.openedAt),
            to: incident.closedAt ? new Date(incident.closedAt) : null,
          })),
      };
    });
}

export function buildHourlyStatusBarData(
  heartbeats: HeartbeatRecord[],
  incidents: IncidentRecord[] = [],
  count = 48,
): StatusBarData[] {
  return buildBucketedStatusBarData({
    heartbeats,
    incidents,
    count,
    intervalMs: 60 * 60 * 1000,
    startOfBucket: startOfHour,
    emptyBuckets: true,
  });
}

export function buildDailyStatusBarData(
  heartbeats: HeartbeatRecord[],
  incidents: IncidentRecord[] = [],
  count = 45,
): StatusBarData[] {
  return buildBucketedStatusBarData({
    heartbeats,
    incidents,
    count,
    intervalMs: 24 * 60 * 60 * 1000,
    startOfBucket: startOfDay,
    emptyBuckets: true,
  });
}

function buildBucketedStatusBarData({
  heartbeats,
  incidents,
  count,
  intervalMs,
  startOfBucket,
  emptyBuckets,
}: {
  heartbeats: HeartbeatRecord[];
  incidents: IncidentRecord[];
  count: number;
  intervalMs: number;
  startOfBucket: (date: Date) => Date;
  emptyBuckets: boolean;
}): StatusBarData[] {
  const latestBucketStart = startOfBucket(new Date());
  const firstBucketStart = new Date(
    latestBucketStart.getTime() - (count - 1) * intervalMs,
  );
  const buckets = Array.from({ length: count }, (_, index) => {
    const start = new Date(firstBucketStart.getTime() + index * intervalMs);
    return {
      start,
      end: new Date(start.getTime() + intervalMs),
      heartbeats: [] as HeartbeatRecord[],
    };
  });
  const bucketByTime = new Map(
    buckets.map((bucket) => [bucket.start.getTime(), bucket]),
  );

  for (const heartbeat of heartbeats) {
    const heartbeatAt = new Date(heartbeat.createdAt);

    if (Number.isNaN(heartbeatAt.getTime())) {
      continue;
    }

    const bucketStart = startOfBucket(heartbeatAt).getTime();
    const bucket = bucketByTime.get(bucketStart);

    if (bucket) {
      bucket.heartbeats.push(heartbeat);
    }
  }

  return buckets
    .filter((bucket) => emptyBuckets || bucket.heartbeats.length > 0)
    .map((bucket) =>
      bucketToStatusBarData(
        bucket.start,
        bucket.end,
        bucket.heartbeats,
        incidents,
      ),
    );
}

function bucketToStatusBarData(
  bucketStart: Date,
  bucketEnd: Date,
  heartbeats: HeartbeatRecord[],
  incidents: IncidentRecord[],
): StatusBarData {
  const counts = heartbeats.reduce(
    (result, heartbeat) => {
      result[heartbeat.status] += 1;
      return result;
    },
    { up: 0, down: 0, unknown: 0 } satisfies Record<MonitorStatus, number>,
  );
  const total = heartbeats.length;
  const orderedCounts = [
    { status: "success" as const, value: counts.up },
    { status: "error" as const, value: counts.down },
    { status: "degraded" as const, value: counts.unknown },
  ];

  return {
    day: bucketStart.toISOString(),
    bar:
      total === 0
        ? [{ status: "empty", height: 100 }]
        : orderedCounts
            .filter((item) => item.value > 0)
            .map((item) => ({
              status: item.status,
              height: (item.value / total) * 100,
            })),
    card:
      total === 0
        ? [{ status: "empty", value: m.common_no_data() }]
        : orderedCounts
            .filter((item) => item.value > 0)
            .map((item) => ({
              status: item.status,
              value: formatBucketCheckCount(item.value, item.status),
            })),
    events: incidents
      .filter((incident) =>
        incidentOverlapsWindow(incident, bucketStart, bucketEnd),
      )
      .map((incident, index) => incidentToStatusBarEvent(incident, index)),
  };
}

function formatBucketCheckCount(
  count: number,
  status: "success" | "error" | "degraded",
) {
  if (status === "success") {
    return m.status_block_successful_check_count({ count });
  }

  if (status === "error") {
    return m.status_block_failed_check_count({ count });
  }

  return m.status_block_unknown_check_count({ count });
}

function startOfHour(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
  );
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function incidentOverlapsHeartbeat(
  incident: IncidentRecord,
  heartbeatAt: Date,
): boolean {
  const openedAt = new Date(incident.openedAt);
  const closedAt = incident.closedAt ? new Date(incident.closedAt) : null;

  if (Number.isNaN(openedAt.getTime())) {
    return false;
  }

  if (heartbeatAt < openedAt) {
    return false;
  }

  if (closedAt && !Number.isNaN(closedAt.getTime()) && heartbeatAt > closedAt) {
    return false;
  }

  return true;
}

function incidentOverlapsWindow(
  incident: IncidentRecord,
  windowStart: Date,
  windowEnd: Date,
): boolean {
  const openedAt = new Date(incident.openedAt);
  const closedAt = incident.closedAt ? new Date(incident.closedAt) : null;

  if (Number.isNaN(openedAt.getTime())) {
    return false;
  }

  const incidentEnd =
    closedAt && !Number.isNaN(closedAt.getTime()) ? closedAt : null;

  if (incidentEnd && incidentEnd < windowStart) {
    return false;
  }

  if (openedAt >= windowEnd) {
    return false;
  }

  return true;
}

function incidentToStatusBarEvent(incident: IncidentRecord, index: number) {
  return {
    id:
      Number.parseInt(incident.id.replace(/\D/g, "").slice(0, 9), 10) ||
      index + 1,
    name: incident.title,
    type: "incident" as const,
    from: new Date(incident.openedAt),
    to: incident.closedAt ? new Date(incident.closedAt) : null,
  };
}
