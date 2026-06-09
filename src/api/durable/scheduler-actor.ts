import { DurableObject } from "cloudflare:workers";
import { createRequestLogger } from "evlog";

import type { AppDb } from "@/api/db";
import type { Bindings } from "@/ctx";
import type { MonitorRecord } from "@/types";

import { createAppDb } from "@/api/db";
import { nowMs } from "@/api/lib/dates";
import { getMonitorNextDueAt, isMonitorDue } from "@/api/lib/monitoring";

const SCHEDULER_ACTOR_NAME = "installation";
const DEFAULT_BATCH_SIZE = 30;
const MIN_RESCHEDULE_DELAY_MS = 1000;

type SchedulerActorEnv = {
  DB: D1Database;
};

type SchedulerReason =
  | "alarm"
  | "dashboard-manual"
  | "manual"
  | "monitor-create"
  | "monitor-delete"
  | "monitor-import"
  | "monitor-pause"
  | "monitor-resume"
  | "monitor-update"
  | "push"
  | "save"
  | string;

export class SchedulerActor extends DurableObject<SchedulerActorEnv> {
  async sync(reason: SchedulerReason = "sync") {
    const log = this.createLog("/do/scheduler/sync");
    try {
      const result = await syncScheduler(createAppDb(this.env.DB), {
        alarm: this.alarmAdapter(),
      });
      log.set({
        action: "scheduler_sync",
        reason,
        scheduler: result,
      });
      log.emit({ status: 200 });
      return result;
    } catch (error) {
      log.error(error instanceof Error ? error : new Error(String(error)));
      log.emit({ status: 500 });
      throw error;
    }
  }

  async runNow(monitorId: string, reason: SchedulerReason = "manual") {
    const log = this.createLog("/do/scheduler/run-now");
    try {
      const db = createAppDb(this.env.DB);
      const result = await runMonitorNowAndReschedule(db, monitorId, {
        alarm: this.alarmAdapter(),
      });
      log.set({
        action: "scheduler_run_now",
        reason,
        monitor: { id: monitorId },
        scheduler: result,
      });
      log.emit({ status: 200 });
      return result;
    } catch (error) {
      log.error(error instanceof Error ? error : new Error(String(error)));
      log.emit({ status: 500 });
      throw error;
    }
  }

  async recordPushHeartbeat(
    monitorId: string,
    reason: SchedulerReason = "push",
  ) {
    const log = this.createLog("/do/scheduler/push-heartbeat");
    try {
      const db = createAppDb(this.env.DB);
      const result = await recordPushHeartbeatAndReschedule(db, monitorId, {
        alarm: this.alarmAdapter(),
      });
      log.set({
        action: "scheduler_push_heartbeat",
        reason,
        monitor: { id: monitorId },
        scheduler: result,
      });
      log.emit({ status: 200 });
      return result;
    } catch (error) {
      log.error(error instanceof Error ? error : new Error(String(error)));
      log.emit({ status: 500 });
      throw error;
    }
  }

  override async alarm() {
    const log = this.createLog("/do/scheduler/alarm");
    try {
      const result = await runDueMonitorsAndReschedule(
        createAppDb(this.env.DB),
        {
          alarm: this.alarmAdapter(),
        },
      );
      log.set({
        action: "scheduler_alarm",
        scheduler: result,
      });
      log.emit({ status: 200 });
    } catch (error) {
      log.error(error instanceof Error ? error : new Error(String(error)));
      log.emit({ status: 500 });
      throw error;
    }
  }

  private alarmAdapter(): SchedulerAlarmAdapter {
    return {
      getAlarm: () => this.ctx.storage.getAlarm(),
      setAlarm: (timestamp) => this.ctx.storage.setAlarm(timestamp),
      deleteAlarm: () => this.ctx.storage.deleteAlarm(),
    };
  }

  private createLog(path: string) {
    return createRequestLogger({
      method: "RPC",
      path,
    });
  }
}

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
  db: AppDb,
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

  await Promise.all(
    selectedMonitors.map((monitor) => runMonitorCheck(db, monitor)),
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
  db: AppDb,
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
  db: AppDb,
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
  db: AppDb,
  monitorId: string,
  options: {
    alarm: SchedulerAlarmAdapter;
    now?: number;
  },
): Promise<SchedulerSingleRunResult> {
  const monitor = await db.monitor.getById(monitorId);
  let ran = false;
  if (monitor?.active === 1 && monitor.kind === "push") {
    await db.lifecycle.recordPushHeartbeat(monitor);
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

async function runMonitorCheck(db: AppDb, monitor: MonitorRecord) {
  if (monitor.kind === "push") {
    await db.lifecycle.recordPushOverdue(monitor);
    return;
  }

  await db.lifecycle.runPollCheck(monitor);
}

async function rescheduleFromActiveMonitors(
  db: AppDb,
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

export function getSchedulerActor(env: Pick<Bindings, "SCHEDULER_ACTOR">) {
  return env.SCHEDULER_ACTOR.getByName(SCHEDULER_ACTOR_NAME);
}

export function queueSchedulerSync(
  ctx: {
    env: Bindings;
    executionCtx: { waitUntil(promise: Promise<unknown>): void };
  },
  reason: SchedulerReason,
) {
  ctx.executionCtx.waitUntil(getSchedulerActor(ctx.env).sync(reason));
}

export function runMonitorNow(
  env: Pick<Bindings, "SCHEDULER_ACTOR">,
  monitorId: string,
  reason: SchedulerReason,
) {
  return getSchedulerActor(env).runNow(monitorId, reason);
}

export function recordPushHeartbeat(
  env: Pick<Bindings, "SCHEDULER_ACTOR">,
  monitorId: string,
  reason: SchedulerReason,
) {
  return getSchedulerActor(env).recordPushHeartbeat(monitorId, reason);
}
