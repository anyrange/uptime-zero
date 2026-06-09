import type { MonitorRecord, MonitorStatus } from "@/types";

import { parseDateMs } from "@/server/lib/dates";
import {
  getCronHeartbeatSchedule,
  getNextCronHeartbeatExpectedAt,
} from "@/server/lib/monitoring-cron";
export {
  compareJsonValue,
  readJsonPath,
  runHttpCheck,
} from "@/server/lib/monitoring-http";

export interface DueCheck {
  due: boolean;
  overdueMs: number;
}

export function computeAggregateStatus(
  statuses: MonitorStatus[],
): MonitorStatus {
  if (statuses.some((status) => status === "down")) {
    return "down";
  }
  if (statuses.some((status) => status === "up")) {
    return "up";
  }
  return "unknown";
}

export function isPushMonitorOverdue(
  lastHeartbeatAt: string | null,
  nowMs: number,
  intervalSec: number,
  timeoutMs: number,
  createdAt: string,
): DueCheck {
  const baseline = lastHeartbeatAt ?? createdAt;
  const overdueMs =
    nowMs - parseDateMs(baseline) - intervalSec * 1000 - timeoutMs;
  return {
    due: overdueMs >= 0,
    overdueMs,
  };
}

export function isCronHeartbeatOverdue(
  monitor: Pick<
    MonitorRecord,
    | "lastCheckedAt"
    | "createdAt"
    | "heartbeatCron"
    | "heartbeatGraceSec"
    | "heartbeatTimezone"
  >,
  nowMs: number,
): DueCheck {
  const baseline = parseDateMs(monitor.lastCheckedAt ?? monitor.createdAt);
  const expectedAt = getNextCronHeartbeatExpectedAt(monitor, baseline);
  const { graceSec } = getCronHeartbeatSchedule(monitor);
  const overdueMs = nowMs - expectedAt - graceSec * 1000;
  return {
    due: overdueMs >= 0,
    overdueMs,
  };
}

export function isMonitorDue(
  monitor: Pick<
    MonitorRecord,
    | "kind"
    | "lastCheckedAt"
    | "intervalSec"
    | "timeoutMs"
    | "createdAt"
    | "heartbeatMode"
    | "heartbeatCron"
    | "heartbeatGraceSec"
    | "heartbeatTimezone"
  >,
  nowMs: number,
): DueCheck {
  if (monitor.kind === "push") {
    if (monitor.heartbeatMode === "cron") {
      return isCronHeartbeatOverdue(monitor, nowMs);
    }
    return isPushMonitorOverdue(
      monitor.lastCheckedAt,
      nowMs,
      monitor.intervalSec,
      monitor.timeoutMs,
      monitor.createdAt,
    );
  }
  const baseline = monitor.lastCheckedAt ?? monitor.createdAt;
  const overdueMs = nowMs - parseDateMs(baseline) - monitor.intervalSec * 1000;
  return {
    due: overdueMs >= 0,
    overdueMs,
  };
}

export function getMonitorNextDueAt(
  monitor: Pick<
    MonitorRecord,
    | "kind"
    | "lastCheckedAt"
    | "intervalSec"
    | "timeoutMs"
    | "createdAt"
    | "heartbeatMode"
    | "heartbeatCron"
    | "heartbeatGraceSec"
    | "heartbeatTimezone"
  >,
): number {
  const baseline = parseDateMs(monitor.lastCheckedAt ?? monitor.createdAt);
  if (monitor.kind === "push" && monitor.heartbeatMode === "cron") {
    const expectedAt = getNextCronHeartbeatExpectedAt(monitor, baseline);
    const { graceSec } = getCronHeartbeatSchedule(monitor);
    return expectedAt + graceSec * 1000;
  }
  const timeoutMs = monitor.kind === "push" ? monitor.timeoutMs : 0;
  return baseline + monitor.intervalSec * 1000 + timeoutMs;
}
