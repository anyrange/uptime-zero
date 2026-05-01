import { DurableObject } from "cloudflare:workers";
import { createRequestLogger } from "evlog";

import { createAppDb } from "@/api/db";
import { MonitorOrchestrator } from "@/api/lib/monitor-orchestration";

type MonitorActorEnv = {
  DB: D1Database;
};

export class MonitorActor extends DurableObject<MonitorActorEnv> {
  async syncConfig(reason = "sync", monitorId?: string) {
    const log = this.createLog("/do/monitor-actor/sync-config");
    const resolvedMonitorId = await this.resolveMonitorId(monitorId);

    try {
      const db = createAppDb(this.env.DB);
      const monitor = resolvedMonitorId
        ? await db.monitor.getById(resolvedMonitorId)
        : null;
      log.set({
        action: "monitor_actor_sync_config",
        monitor: {
          id: resolvedMonitorId,
          reason,
          active: monitor?.active ?? 0,
          kind: monitor?.kind ?? null,
        },
      });
      const result =
        await this.createOrchestrator(db).syncMonitor(resolvedMonitorId);
      log.emit({ status: 200 });
      return result;
    } catch (error) {
      log.error(error instanceof Error ? error : new Error(String(error)));
      log.emit({ status: 500 });
      throw error;
    }
  }

  async runNow(reason = "manual", monitorId?: string) {
    const log = this.createLog("/do/monitor-actor/run-now");
    const resolvedMonitorId = await this.resolveMonitorId(monitorId);

    try {
      const db = createAppDb(this.env.DB);
      const monitor = resolvedMonitorId
        ? await db.monitor.getById(resolvedMonitorId)
        : null;
      log.set({
        action: "monitor_actor_run_now",
        monitor: {
          id: resolvedMonitorId,
          reason,
          active: monitor?.active ?? 0,
          kind: monitor?.kind ?? null,
        },
      });
      const result = await this.createOrchestrator(db).runMonitorNow(
        resolvedMonitorId,
        "manual",
      );
      log.emit({ status: 200 });
      return result;
    } catch (error) {
      log.error(error instanceof Error ? error : new Error(String(error)));
      log.emit({ status: 500 });
      throw error;
    }
  }

  async recordPushHeartbeat(reason = "push", monitorId?: string) {
    const log = this.createLog("/do/monitor-actor/record-push-heartbeat");
    const resolvedMonitorId = await this.resolveMonitorId(monitorId);

    try {
      const db = createAppDb(this.env.DB);
      const monitor = resolvedMonitorId
        ? await db.monitor.getById(resolvedMonitorId)
        : null;
      log.set({
        action: "monitor_actor_record_push_heartbeat",
        monitor: {
          id: resolvedMonitorId,
          reason,
          active: monitor?.active ?? 0,
          kind: monitor?.kind ?? null,
        },
      });
      const result =
        await this.createOrchestrator(db).recordPushHeartbeat(
          resolvedMonitorId,
        );
      log.emit({ status: 200 });
      return result;
    } catch (error) {
      log.error(error instanceof Error ? error : new Error(String(error)));
      log.emit({ status: 500 });
      throw error;
    }
  }

  async deactivate(reason = "deactivate", monitorId?: string) {
    const log = this.createLog("/do/monitor-actor/deactivate");
    const resolvedMonitorId = await this.resolveMonitorId(monitorId);

    try {
      log.set({
        action: "monitor_actor_deactivate",
        monitor: {
          id: resolvedMonitorId,
          reason,
        },
      });
      await this.createOrchestrator(
        createAppDb(this.env.DB),
      ).deactivateMonitor();
      log.emit({ status: 200 });
      return { ok: true };
    } catch (error) {
      log.error(error instanceof Error ? error : new Error(String(error)));
      log.emit({ status: 500 });
      throw error;
    }
  }

  override async alarm() {
    const log = this.createLog("/do/monitor-actor/alarm");
    const monitorId = await this.resolveMonitorId();

    try {
      const db = createAppDb(this.env.DB);
      const monitor = monitorId ? await db.monitor.getById(monitorId) : null;
      log.set({
        action: "monitor_actor_alarm",
        monitor: {
          id: monitorId,
          active: monitor?.active ?? 0,
          kind: monitor?.kind ?? null,
          target: monitor?.target,
        },
      });
      await this.createOrchestrator(db).runMonitorNow(monitorId, "alarm");
      log.emit({ status: 200 });
    } catch (error) {
      log.error(error instanceof Error ? error : new Error(String(error)));
      log.emit({ status: 500 });
      throw error;
    }
  }

  private createOrchestrator(db: ReturnType<typeof createAppDb>) {
    return new MonitorOrchestrator(db, {
      getAlarm: () => this.ctx.storage.getAlarm(),
      setAlarm: (timestamp) => this.ctx.storage.setAlarm(timestamp),
      deleteAlarm: () => this.ctx.storage.deleteAlarm(),
    });
  }

  private createLog(path: string) {
    return createRequestLogger({
      method: "RPC",
      path,
    });
  }

  private async resolveMonitorId(monitorId?: string) {
    if (monitorId) {
      await this.ctx.storage.put("monitorId", monitorId);
      return monitorId;
    }

    return (await this.ctx.storage.get<string>("monitorId")) ?? null;
  }
}
