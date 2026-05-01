import type { AppDb } from "@/api/db";

import { nowMs } from "@/api/lib/dates";
import { getMonitorNextDueAt, isMonitorDue } from "@/api/lib/monitoring";

export interface MonitorAlarmAdapter {
  getAlarm(): Promise<number | null>;
  setAlarm(timestamp: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}

export type MonitorRunMode = "alarm" | "manual";

export class MonitorOrchestrator {
  constructor(
    private readonly db: AppDb,
    private readonly alarm: MonitorAlarmAdapter,
  ) {}

  async syncMonitor(monitorId: string | null) {
    const monitor = monitorId ? await this.db.monitor.getById(monitorId) : null;
    if (!monitor || monitor.active !== 1) {
      await this.clearAlarm();
      return { ok: true, active: false, scheduledFor: null };
    }

    const scheduledFor = await this.scheduleForMonitor(monitor);
    return { ok: true, active: true, scheduledFor };
  }

  async runMonitorNow(monitorId: string | null, mode: MonitorRunMode) {
    let monitor = monitorId ? await this.db.monitor.getById(monitorId) : null;
    if (!monitor || monitor.active !== 1) {
      await this.clearAlarm();
      return { ok: true, ran: false, scheduledFor: null };
    }

    if (mode === "alarm") {
      const due = isMonitorDue(monitor, nowMs());
      if (!due.due) {
        const scheduledFor = await this.scheduleForMonitor(monitor);
        return { ok: true, ran: false, scheduledFor };
      }
    }

    if (monitor.kind === "push") {
      const due = isMonitorDue(monitor, nowMs());
      if (due.due) {
        await this.db.lifecycle.recordPushOverdue(monitor);
      }
    } else {
      await this.db.lifecycle.runPollCheck(monitor);
    }

    monitor = monitorId ? await this.db.monitor.getById(monitorId) : null;
    if (!monitor || monitor.active !== 1) {
      await this.clearAlarm();
      return { ok: true, ran: true, scheduledFor: null };
    }

    const scheduledFor = await this.scheduleForMonitor(monitor);
    return { ok: true, ran: true, scheduledFor };
  }

  async recordPushHeartbeat(monitorId: string | null) {
    let monitor = monitorId ? await this.db.monitor.getById(monitorId) : null;
    if (!monitor || monitor.active !== 1 || monitor.kind !== "push") {
      await this.clearAlarm();
      return { ok: true, recorded: false, scheduledFor: null };
    }

    await this.db.lifecycle.recordPushHeartbeat(monitor);
    monitor = monitorId ? await this.db.monitor.getById(monitorId) : null;
    if (!monitor || monitor.active !== 1) {
      await this.clearAlarm();
      return { ok: true, recorded: true, scheduledFor: null };
    }

    const scheduledFor = await this.scheduleForMonitor(monitor);
    return { ok: true, recorded: true, scheduledFor };
  }

  async deactivateMonitor() {
    await this.clearAlarm();
    return { ok: true };
  }

  private async scheduleForMonitor(
    monitor: Parameters<typeof getMonitorNextDueAt>[0],
  ) {
    const scheduledFor = Math.max(nowMs(), getMonitorNextDueAt(monitor));
    await this.scheduleForMonitorAt(scheduledFor);
    return scheduledFor;
  }

  private async scheduleForMonitorAt(scheduledFor: number) {
    const existingAlarm = await this.alarm.getAlarm();

    if (existingAlarm === null || existingAlarm !== scheduledFor) {
      await this.alarm.setAlarm(scheduledFor);
    }

    return scheduledFor;
  }

  private async clearAlarm() {
    const existingAlarm = await this.alarm.getAlarm();
    if (existingAlarm !== null) {
      await this.alarm.deleteAlarm();
    }
  }
}
