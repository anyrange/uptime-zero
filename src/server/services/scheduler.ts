import type { Database } from "@/server/db";
import type { MonitorRecord } from "@/types";

import { nowMs } from "@/server/lib/dates";
import { getMonitorNextDueAt, isMonitorDue } from "@/server/lib/monitoring";
import { MonitorLifecycle } from "@/server/services/monitor-lifecycle";

const DEFAULT_BATCH_SIZE = 2;
const MIN_RESCHEDULE_DELAY_MS = 1000;
const FAILED_CHECK_RETRY_DELAY_MS = 30_000;

export interface SchedulerAlarmAdapter {
  getAlarm(): Promise<number | null>;
  setAlarm(timestamp: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}

export type SchedulerRunResult = {
  active: number;
  due: number;
  checked: number;
  failed: number;
  nextAlarmAt: number | null;
};

export type SchedulerSingleRunResult = {
  ran: boolean;
  active: number;
  nextAlarmAt: number | null;
};

export async function runDueMonitorsAndReschedule(
  db: Database,
  options: {
    alarm: SchedulerAlarmAdapter;
    now?: number;
    batchSize?: number;
    executeMonitor?: (monitor: MonitorRecord) => Promise<void>;
  },
): Promise<SchedulerRunResult> {
  const currentTime = options.now ?? nowMs();
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const activeMonitors = await db.monitor.listActive();
  const dueMonitors = activeMonitors.filter(
    (monitor) => isMonitorDue(monitor, currentTime).due,
  );
  const selectedMonitors = dueMonitors.slice(0, batchSize);

  const checkResults = await Promise.allSettled(
    selectedMonitors.map((monitor) =>
      options.executeMonitor
        ? options.executeMonitor(monitor)
        : runMonitorCheck(db, monitor),
    ),
  );
  for (const [index, result] of checkResults.entries()) {
    if (result.status === "rejected") {
      console.error(
        JSON.stringify({
          message: "monitor check failed before persistence completed",
          monitorId: selectedMonitors[index]?.id,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        }),
      );
    }
  }

  const nextAlarmAt = await rescheduleFromActiveMonitors(db, options.alarm, {
    now: options.now ?? nowMs(),
    forceSoon: dueMonitors.length > selectedMonitors.length,
    minimumDelayMs: checkResults.some((result) => result.status === "rejected")
      ? FAILED_CHECK_RETRY_DELAY_MS
      : MIN_RESCHEDULE_DELAY_MS,
  });

  return {
    active: activeMonitors.length,
    due: dueMonitors.length,
    checked: selectedMonitors.length,
    failed: checkResults.filter((result) => result.status === "rejected")
      .length,
    nextAlarmAt,
  };
}

export async function syncScheduler(
  db: Database,
  options: {
    alarm: SchedulerAlarmAdapter;
    now?: number;
  },
) {
  const nextAlarmAt = await rescheduleFromActiveMonitors(db, options.alarm, {
    now: options.now ?? nowMs(),
  });
  const activeMonitors = await db.monitor.listActive();
  return {
    active: activeMonitors.length,
    nextAlarmAt,
  };
}

export async function runMonitorNowAndReschedule(
  db: Database,
  monitorId: string,
  options: {
    alarm: SchedulerAlarmAdapter;
    now?: number;
  },
): Promise<SchedulerSingleRunResult> {
  const monitor = await db.monitor.getById(monitorId);
  let ran = false;
  if (monitor?.active === 1) {
    await runMonitorCheck(db, monitor);
    ran = true;
  }

  const nextAlarmAt = await rescheduleFromActiveMonitors(db, options.alarm, {
    now: options.now ?? nowMs(),
  });
  const activeMonitors = await db.monitor.listActive();

  return {
    ran,
    active: activeMonitors.length,
    nextAlarmAt,
  };
}

export async function recordPushHeartbeatAndReschedule(
  db: Database,
  monitorId: string,
  options: {
    alarm: SchedulerAlarmAdapter;
    now?: number;
  },
): Promise<SchedulerSingleRunResult> {
  const monitor = await db.monitor.getById(monitorId);
  let ran = false;

  const monitorLifecycle = new MonitorLifecycle(db);

  if (monitor?.active === 1 && monitor.kind === "push") {
    await monitorLifecycle.recordPushHeartbeat(monitor);
    ran = true;
  }

  const nextAlarmAt = await rescheduleFromActiveMonitors(db, options.alarm, {
    now: options.now ?? nowMs(),
  });
  const activeMonitors = await db.monitor.listActive();
  return {
    ran,
    active: activeMonitors.length,
    nextAlarmAt,
  };
}

export async function runMonitorCheck(db: Database, monitor: MonitorRecord) {
  const lifecycle = new MonitorLifecycle(db);
  if (monitor.kind === "push") {
    await lifecycle.recordPushOverdue(monitor);
    return;
  }

  await lifecycle.runPollCheck(monitor);
}

async function rescheduleFromActiveMonitors(
  db: Database,
  alarm: SchedulerAlarmAdapter,
  options: {
    now: number;
    forceSoon?: boolean;
    minimumDelayMs?: number;
  },
) {
  const activeMonitors = await db.monitor.listActive();
  if (activeMonitors.length === 0) {
    await clearAlarm(alarm);
    return null;
  }

  const earliestDueAt = Math.min(...activeMonitors.map(getMonitorNextDueAt));
  const minimumNextAlarmAt =
    options.now + (options.minimumDelayMs ?? MIN_RESCHEDULE_DELAY_MS);
  const nextAlarmAt = options.forceSoon
    ? minimumNextAlarmAt
    : Math.max(minimumNextAlarmAt, earliestDueAt);
  await setAlarmIfChanged(alarm, nextAlarmAt);
  return nextAlarmAt;
}

async function setAlarmIfChanged(
  alarm: SchedulerAlarmAdapter,
  nextAlarmAt: number,
) {
  const existingAlarm = await alarm.getAlarm();
  if (existingAlarm !== nextAlarmAt) {
    await alarm.setAlarm(nextAlarmAt);
  }
}

async function clearAlarm(alarm: SchedulerAlarmAdapter) {
  const existingAlarm = await alarm.getAlarm();
  if (existingAlarm !== null) {
    await alarm.deleteAlarm();
  }
}
