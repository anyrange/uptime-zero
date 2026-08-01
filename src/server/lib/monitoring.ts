import type { MonitorRecord, MonitorStatus } from "@/types";

import {
  MAX_MONITOR_RETRIES,
  MAX_MONITOR_TIMEOUT_MS,
} from "@/lib/monitor/config";
import { parseDateMs } from "@/server/lib/dates";
import {
  getCronHeartbeatSchedule,
  getNextCronHeartbeatExpectedAt,
} from "@/server/lib/monitoring-cron";
import { runHttpCheck } from "@/server/lib/monitoring-http";
export {
  compareJsonValue,
  readJsonPath,
  runHttpCheck,
} from "@/server/lib/monitoring-http";

type PollMonitorConfig = Pick<
  MonitorRecord,
  "kind" | "target" | "timeoutMs" | "retries" | "assertions"
>;

export async function runConfiguredMonitorCheck(
  monitor: PollMonitorConfig,
  fetchImpl: typeof fetch = fetch,
) {
  const boundedMonitor = {
    ...monitor,
    timeoutMs: Math.min(monitor.timeoutMs, MAX_MONITOR_TIMEOUT_MS),
  };
  let result = await runHttpCheck(boundedMonitor, fetchImpl);
  for (
    let attempt = 0;
    attempt < Math.min(monitor.retries, MAX_MONITOR_RETRIES) &&
    result.status === "down";
    attempt += 1
  ) {
    result = await runHttpCheck(boundedMonitor, fetchImpl);
  }
  return result;
}

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
