import type { AppDb } from "@/api/db";
import type { MonitorRecord } from "@/types";

import { nowMs } from "@/api/lib/dates";
import { isMonitorDue } from "@/api/lib/monitoring";

export type MonitorRunReason = "cron" | "manual" | "monitor-import" | "save";

export async function runMonitorCheckNow(
  db: AppDb,
  monitorId: string,
  reason: MonitorRunReason,
) {
  const monitor = await db.monitor.getById(monitorId);
  if (!monitor || monitor.active !== 1) {
    return { ok: true, ran: false, reason };
  }

  await runMonitorCheck(db, monitor);
  return { ok: true, ran: true, reason };
}

export async function runDueMonitorBatch(
  db: AppDb,
  options: {
    now?: number;
    batchSize?: number;
  } = {},
) {
  const currentTime = options.now ?? nowMs();
  const batchSize = options.batchSize ?? 30;
  const activeMonitors = await db.monitor.listActive();
  const dueMonitors = activeMonitors.filter(
    (monitor) => isMonitorDue(monitor, currentTime).due,
  );
  const selectedMonitors = selectCronMonitorBatch(
    dueMonitors,
    currentTime,
    batchSize,
  );

  await Promise.all(
    selectedMonitors.map((monitor) => runMonitorCheck(db, monitor)),
  );

  return {
    checked: selectedMonitors.length,
    due: dueMonitors.length,
    active: activeMonitors.length,
  };
}

async function runMonitorCheck(db: AppDb, monitor: MonitorRecord) {
  if (monitor.kind === "push") {
    await db.lifecycle.recordPushOverdue(monitor);
    return;
  }

  await db.lifecycle.runPollCheck(monitor);
}

export function selectCronMonitorBatch<T>(
  monitors: T[],
  now: number,
  batchSize = 30,
) {
  if (monitors.length <= batchSize) {
    return monitors;
  }

  const start = (Math.floor(now / 60_000) * batchSize) % monitors.length;
  return Array.from({ length: batchSize }, (_, index) => {
    return monitors[(start + index) % monitors.length];
  });
}
