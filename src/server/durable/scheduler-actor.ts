import { DurableObject } from "cloudflare:workers";
import { createRequestLogger } from "evlog";

import type { Bindings } from "@/ctx";
import type { SchedulerAlarmAdapter } from "@/server/services/scheduler";

import { createDatabase } from "@/server/db";
import {
  recordPushHeartbeatAndReschedule,
  runDueMonitorsAndReschedule,
  runMonitorCheck,
  runMonitorNowAndReschedule,
  syncScheduler,
} from "@/server/services/scheduler";

const SCHEDULER_ACTOR_NAME = "installation";
const ALARM_RECOVERY_DELAY_MS = 30_000;

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

export class SchedulerActor extends DurableObject<Env> {
  private readonly monitorRuns = new Map<string, Promise<unknown>>();

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
      const result = await this.withMonitorLock(monitorId, () =>
        runMonitorNowAndReschedule(db, monitorId, {
          alarm: this.alarmAdapter(),
        }),
      );
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
      const result = await this.withMonitorLock(monitorId, () =>
        recordPushHeartbeatAndReschedule(db, monitorId, {
          alarm: this.alarmAdapter(),
        }),
      );
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
      if (this.ctx.id.name !== SCHEDULER_ACTOR_NAME) {
        await getSchedulerActor(this.env).sync("scheduler-consolidation");
        await this.ctx.storage.deleteAlarm();
        log.set({ action: "scheduler_consolidation" });
        log.emit({ status: 200 });
        return;
      }

      const db = createDatabase(this.env.DB);
      const result = await runDueMonitorsAndReschedule(db, {
        alarm: this.alarmAdapter(),
        executeMonitor: (monitor) =>
          this.withMonitorLock(monitor.id, async () => {
            const currentMonitor = await db.monitor.getById(monitor.id);
            if (!currentMonitor || currentMonitor.active !== 1) {
              return;
            }
            await runMonitorCheck(db, currentMonitor);
          }),
      });
      log.set({
        action: "scheduler_alarm",
        scheduler: result,
      });
      log.emit({ status: 200 });
    } catch (error) {
      log.error(error instanceof Error ? error : new Error(String(error)));
      log.emit({ status: 500 });
      await this.ctx.storage.setAlarm(Date.now() + ALARM_RECOVERY_DELAY_MS);
    }
  }

  private alarmAdapter(): SchedulerAlarmAdapter {
    return {
      getAlarm: () => this.ctx.storage.getAlarm(),
      setAlarm: (timestamp) => this.ctx.storage.setAlarm(timestamp),
      deleteAlarm: () => this.ctx.storage.deleteAlarm(),
    };
  }

  private async withMonitorLock<T>(
    monitorId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.monitorRuns.get(monitorId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.monitorRuns.set(monitorId, current);

    try {
      return await current;
    } finally {
      if (this.monitorRuns.get(monitorId) === current) {
        this.monitorRuns.delete(monitorId);
      }
    }
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
  monitor: { active: number },
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
