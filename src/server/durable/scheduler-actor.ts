import { DurableObject } from "cloudflare:workers";

import type { Bindings } from "@/ctx";
import type { SchedulerAlarmAdapter } from "@/server/services/scheduler";

import { createDatabase } from "@/server/db";
import { logger } from "@/server/lib/logger";
import { isMonitorDue } from "@/server/lib/monitoring";
import {
  recordPushHeartbeatAndReschedule,
  runDueMonitorsAndReschedule,
  runMonitorCheck,
  runMonitorNowAndReschedule,
  syncScheduler,
} from "@/server/services/scheduler";

const SCHEDULER_ACTOR_NAME = "installation";

const ALARM_RECOVERY_DELAY_MS = 30_000;

const HEARTBEAT_ROLLUP_BACKFILLED_KEY = "heartbeat-rollup-backfilled-v1";

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
    try {
      const db = createDatabase(this.env.DB);
      await this.ensureHeartbeatRollupBackfill(db);

      const result = await syncScheduler(db, {
        alarm: this.alarmAdapter(),
      });

      this.ctx.waitUntil(
        this.env.NOTIFICATION_ACTOR.getByName("installation").sync(),
      );
      logger
        .withMetadata({ reason, scheduler: result })
        .info("scheduler synced");

      return result;
    } catch (error) {
      logger
        .withError(error)
        .withMetadata({ reason })
        .error("scheduler sync failed");
      throw error;
    }
  }

  async runNow(monitorId: string, reason: SchedulerReason = "manual") {
    try {
      const db = createDatabase(this.env.DB);
      await this.ensureHeartbeatRollupBackfill(db);

      const result = await this.withMonitorLock(monitorId, () =>
        runMonitorNowAndReschedule(db, monitorId, {
          alarm: this.alarmAdapter(),
        }),
      );

      this.ctx.waitUntil(
        this.env.NOTIFICATION_ACTOR.getByName("installation").sync(),
      );
      logger
        .withMetadata({ reason, monitorId, scheduler: result })
        .info("monitor run now completed");

      return result;
    } catch (error) {
      logger
        .withError(error)
        .withMetadata({ reason, monitorId })
        .error("monitor run now failed");
      throw error;
    }
  }

  async recordPushHeartbeat(
    monitorId: string,
    reason: SchedulerReason = "push",
  ) {
    try {
      const db = createDatabase(this.env.DB);
      await this.ensureHeartbeatRollupBackfill(db);

      const result = await this.withMonitorLock(monitorId, () =>
        recordPushHeartbeatAndReschedule(db, monitorId, {
          alarm: this.alarmAdapter(),
        }),
      );

      this.ctx.waitUntil(
        this.env.NOTIFICATION_ACTOR.getByName("installation").sync(),
      );
      logger
        .withMetadata({ reason, monitorId, scheduler: result })
        .info("push heartbeat rescheduled");

      return result;
    } catch (error) {
      logger
        .withError(error)
        .withMetadata({ reason, monitorId })
        .error("push heartbeat reschedule failed");
      throw error;
    }
  }

  override async alarm() {
    try {
      if (this.ctx.id.name !== SCHEDULER_ACTOR_NAME) {
        await getSchedulerActor(this.env).sync("scheduler-consolidation");
        await this.ctx.storage.deleteAlarm();
        this.ctx.waitUntil(
          this.env.NOTIFICATION_ACTOR.getByName("installation").sync(),
        );
        logger.info("scheduler consolidated");

        return;
      }

      const db = createDatabase(this.env.DB);
      await this.ensureHeartbeatRollupBackfill(db);

      const result = await runDueMonitorsAndReschedule(db, {
        alarm: this.alarmAdapter(),
        executeMonitor: (monitor) =>
          this.withMonitorLock(monitor.id, async () => {
            const currentMonitor = await db.monitor.getById(monitor.id);

            if (
              !currentMonitor ||
              currentMonitor.active !== 1 ||
              !isMonitorDue(currentMonitor, Date.now()).due
            ) {
              return;
            }

            await runMonitorCheck(db, currentMonitor);
          }),
      });

      this.ctx.waitUntil(
        this.env.NOTIFICATION_ACTOR.getByName("installation").sync(),
      );
      logger.withMetadata({ scheduler: result }).info("scheduler alarm ran");
    } catch (error) {
      logger.withError(error).error("scheduler alarm failed");
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

  private async ensureHeartbeatRollupBackfill(
    db: ReturnType<typeof createDatabase>,
  ) {
    if (await this.ctx.storage.get<boolean>(HEARTBEAT_ROLLUP_BACKFILLED_KEY)) {
      return;
    }

    await db.maintenance.backfillHeartbeatDaily();
    await this.ctx.storage.put(HEARTBEAT_ROLLUP_BACKFILLED_KEY, true);
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
