import { all } from "better-all";

import type { Database } from "@/server/db";
import type { MonitorRecord } from "@/types";

import { nowMs } from "@/server/lib/dates";
import { getMonitorNextDueAt, isMonitorDue } from "@/server/lib/monitoring";
import { MonitorLifecycle } from "@/server/services/monitor-lifecycle";

const DEFAULT_BATCH_SIZE = 30;
const MIN_RESCHEDULE_DELAY_MS = 1000;

export interface SchedulerAlarmAdapter {
  getAlarm(): Promise<number | null>;
  setAlarm(timestamp: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}

export type SchedulerRunResult = {
  active: number;
  due: number;
  checked: number;
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
  },
): Promise<SchedulerRunResult> {
  const currentTime = options.now ?? nowMs();
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const activeMonitors = await db.monitor.listActive();
  const dueMonitors = activeMonitors.filter(
    (monitor) => isMonitorDue(monitor, currentTime).due,
  );
  const selectedMonitors = dueMonitors.slice(0, batchSize);

  await all(
    Object.fromEntries(
      selectedMonitors.map((monitor) => [
        monitor.id,
        () => runMonitorCheck(db, monitor),
      ]),
    ),
  );

  const nextAlarmAt = await rescheduleFromActiveMonitors(db, options.alarm, {
    now: currentTime,
    forceSoon: dueMonitors.length > selectedMonitors.length,
  });

  return {
    active: activeMonitors.length,
    due: dueMonitors.length,
    checked: selectedMonitors.length,
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

async function runMonitorCheck(db: Database, monitor: MonitorRecord) {
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
  },
) {
  const activeMonitors = await db.monitor.listActive();
  if (activeMonitors.length === 0) {
    await clearAlarm(alarm);
    return null;
  }

  const earliestDueAt = Math.min(...activeMonitors.map(getMonitorNextDueAt));
  const nextAlarmAt = options.forceSoon
    ? options.now + MIN_RESCHEDULE_DELAY_MS
    : Math.max(options.now + MIN_RESCHEDULE_DELAY_MS, earliestDueAt);
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
