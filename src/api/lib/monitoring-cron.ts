import { Cron } from "croner";

import type { MonitorRecord } from "@/types";

import {
  DEFAULT_HEARTBEAT_CRON,
  DEFAULT_HEARTBEAT_GRACE_SEC,
  DEFAULT_HEARTBEAT_TIMEZONE,
} from "@/lib/monitor-config";

export function getCronHeartbeatSchedule(
  monitor: Pick<
    MonitorRecord,
    "heartbeatCron" | "heartbeatGraceSec" | "heartbeatTimezone"
  >,
) {
  return {
    cron: monitor.heartbeatCron || DEFAULT_HEARTBEAT_CRON,
    graceSec: monitor.heartbeatGraceSec ?? DEFAULT_HEARTBEAT_GRACE_SEC,
    timezone: monitor.heartbeatTimezone || DEFAULT_HEARTBEAT_TIMEZONE,
  };
}

export function getNextCronHeartbeatExpectedAt(
  monitor: Pick<
    MonitorRecord,
    "heartbeatCron" | "heartbeatGraceSec" | "heartbeatTimezone"
  >,
  baselineMs: number,
) {
  const schedule = getCronHeartbeatSchedule(monitor);
  const cron = new Cron(schedule.cron, {
    paused: true,
    timezone: schedule.timezone,
  });
  const nextRun = cron.nextRun(new Date(baselineMs));
  return nextRun?.getTime() ?? baselineMs;
}
