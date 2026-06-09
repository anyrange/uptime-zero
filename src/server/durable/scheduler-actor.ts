import { DurableObject } from "cloudflare:workers";
import { createRequestLogger } from "evlog";

import type { Bindings } from "@/ctx";
import type { SchedulerAlarmAdapter } from "@/server/services/scheduler";
import type { MonitorRecord } from "@/types";

import { createDatabase } from "@/server/db";
import {
  recordPushHeartbeatAndReschedule,
  runDueMonitorsAndReschedule,
  runMonitorNowAndReschedule,
  syncScheduler,
} from "@/server/services/scheduler";

const SCHEDULER_ACTOR_NAME = "installation";

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
      const result = await syncScheduler(createDatabase(this.env.DB), {
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
      const db = createDatabase(this.env.DB);
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
      const db = createDatabase(this.env.DB);
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
        createDatabase(this.env.DB),
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

export function queueSchedulerForSavedMonitor(
  ctx: {
    env: Bindings;
    executionCtx: { waitUntil(promise: Promise<unknown>): void };
  },
  monitor: Pick<MonitorRecord, "active">,
  activeReason: SchedulerReason,
) {
  queueSchedulerSync(
    ctx,
    monitor.active === 1 ? activeReason : "monitor-pause",
  );
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
