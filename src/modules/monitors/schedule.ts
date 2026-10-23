import "@tanstack/react-start/server-only";
import { Cron } from "croner";

import type { Monitor, MonitorStatus } from "@/lib/schemas/monitors";

import {
  DEFAULT_HEARTBEAT_CRON,
  DEFAULT_HEARTBEAT_GRACE_SEC,
  DEFAULT_HEARTBEAT_TIMEZONE,
} from "@/lib/schemas/monitor-config";

/** Pure scheduling rules: when a monitor's next check (or heartbeat) is due. */

type Schedulable = Pick<
  Monitor,
  | "kind"
  | "lastCheckedAt"
  | "intervalSec"
  | "timeoutMs"
  | "createdAt"
  | "heartbeatMode"
  | "heartbeatCron"
  | "heartbeatGraceSec"
  | "heartbeatTimezone"
  | "retryAt"
>;

type CronHeartbeat = Pick<
  Monitor,
  "heartbeatCron" | "heartbeatGraceSec" | "heartbeatTimezone"
>;

/**
 * Epoch ms when the monitor is next due:
 * - after a failed check, its back-off time;
 * - poll monitors, one interval after the last check;
 * - interval heartbeats, one interval plus the timeout after the last ping;
 * - cron heartbeats, the next scheduled run plus its grace period.
 */
export function nextDueAt(monitor: Schedulable): number {
  if (monitor.retryAt) return monitor.retryAt;

  const baseline = Date.parse(monitor.lastCheckedAt ?? monitor.createdAt);

  if (monitor.kind === "push" && monitor.heartbeatMode === "cron") {
    return (
      nextCronRunAt(monitor, baseline) +
      cronHeartbeatSchedule(monitor).graceSec * 1000
    );
  }

  const timeoutMs = monitor.kind === "push" ? monitor.timeoutMs : 0;

  return baseline + monitor.intervalSec * 1000 + timeoutMs;
}

export function isDue(monitor: Schedulable, now: number) {
  return now >= nextDueAt(monitor);
}

export function cronHeartbeatSchedule(monitor: CronHeartbeat) {
  return {
    cron: monitor.heartbeatCron || DEFAULT_HEARTBEAT_CRON,
    graceSec: monitor.heartbeatGraceSec ?? DEFAULT_HEARTBEAT_GRACE_SEC,
    timezone: monitor.heartbeatTimezone || DEFAULT_HEARTBEAT_TIMEZONE,
  };
}

/** The first scheduled run after `baselineMs` in the monitor's time zone. */
export function nextCronRunAt(monitor: CronHeartbeat, baselineMs: number) {
  const schedule = cronHeartbeatSchedule(monitor);

  const cron = new Cron(schedule.cron, {
    paused: true,
    timezone: schedule.timezone,
  });

  return cron.nextRun(new Date(baselineMs))?.getTime() ?? baselineMs;
}

/** Down beats up beats unknown, so one failing monitor marks the page down. */
export function aggregateStatus(
  statuses: ReadonlyArray<MonitorStatus>,
): MonitorStatus {
  if (statuses.includes("down")) return "down";

  if (statuses.includes("up")) return "up";

  return "unknown";
}
