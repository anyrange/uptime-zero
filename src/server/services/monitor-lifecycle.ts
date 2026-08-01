import type { Database } from "@/server/db";
import type {
  HeartbeatRecord,
  MonitorCheckResult,
  MonitorRecord,
  MonitorStatus,
} from "@/types";

import {
  MAX_MONITOR_NOTIFICATION_DESTINATIONS,
  MAX_MONITOR_RETRIES,
  MAX_MONITOR_TIMEOUT_MS,
} from "@/lib/monitor/config";
import { nowIso } from "@/server/lib/dates";
import { runHttpCheck } from "@/server/lib/monitoring";
import {
  getCronHeartbeatSchedule,
  getNextCronHeartbeatExpectedAt,
} from "@/server/lib/monitoring-cron";
import { dispatchNotificationEvent } from "@/server/services/notifications/delivery";

export class MonitorLifecycle {
  constructor(private readonly db: Database) {}

  async runPollCheck(monitor: MonitorRecord) {
    const result = await this.performCheck(monitor);
    const checkedAt = nowIso();
    await this.persistCheckResult(monitor, result, "poll", checkedAt);
  }

  async recordPushOverdue(monitor: MonitorRecord) {
    const checkedAt = nowIso();
    const error =
      monitor.heartbeatMode === "cron"
        ? buildCronHeartbeatOverdueMessage(monitor)
        : `No heartbeat received in the last ${monitor.intervalSec}s`;
    await this.persistCheckResult(
      monitor,
      { status: "down", statusCode: null, durationMs: 0, error },
      "system",
      checkedAt,
    );
  }

  async recordPushHeartbeat(monitor: MonitorRecord) {
    const checkedAt = nowIso();
    await this.persistCheckResult(
      monitor,
      {
        status: "up",
        statusCode: 200,
        durationMs: 0,
        error: null,
      },
      "push",
      checkedAt,
    );
  }

  private async performCheck(
    monitor: MonitorRecord,
    fetchImpl: typeof fetch = fetch,
  ) {
    const boundedMonitor = {
      ...monitor,
      timeoutMs: Math.min(monitor.timeoutMs, MAX_MONITOR_TIMEOUT_MS),
    };
    let result = await runHttpCheck(boundedMonitor, fetchImpl);
    for (
      let attempt = 0;
      attempt < Math.min(monitor.retries, MAX_MONITOR_RETRIES) &&
      result.status === "down";
      attempt += 1
    ) {
      result = await runHttpCheck(boundedMonitor, fetchImpl);
    }
    return result;
  }

  private async persistCheckResult(
    monitor: MonitorRecord,
    result: MonitorCheckResult,
    source: HeartbeatRecord["source"],
    checkedAt = nowIso(),
  ) {
    await this.db.monitor.insertHeartbeat(
      monitor.id,
      result,
      source,
      checkedAt,
    );

    await this.db.monitor.updateState(
      monitor.id,
      result.status,
      checkedAt,
      result.durationMs,
      result.error,
    );
    await this.handleTransition(
      monitor,
      result.status,
      checkedAt,
      result.error,
    );
  }

  private async handleTransition(
    monitor: MonitorRecord,
    nextStatus: MonitorStatus,
    checkedAt: string,
    error: string | null,
  ) {
    if (monitor.lastStatus === nextStatus) {
      if (nextStatus === "down") {
        await this.deliverDownNotificationAfterGrace(monitor, checkedAt, error);
      }
      return;
    }
    if (nextStatus === "down") {
      await this.db.incident.openForMonitorIfMissing({
        monitorId: monitor.id,
        title: `${monitor.name} is down`,
        body: error,
        openedAt: checkedAt,
      });
      if (monitor.notificationGraceSec === 0) {
        await this.deliverDownNotification(monitor, checkedAt, error);
      }
      return;
    }
    if (nextStatus === "up") {
      await this.db.incident.closeOpenForMonitor(monitor.id, checkedAt);
      if (monitor.lastDownNotifiedAt) {
        await this.deliverMonitorNotifications(monitor, "up", checkedAt, null);
      }
      await this.db.monitor.clearDownNotificationDelivered(
        monitor.id,
        checkedAt,
      );
    }
  }

  private async deliverDownNotificationAfterGrace(
    monitor: MonitorRecord,
    checkedAt: string,
    error: string | null,
  ) {
    if (monitor.lastDownNotifiedAt) return;

    const incident = await this.db.incident.getOpenForMonitor(monitor.id);
    if (!incident) return;

    const downtimeMs = Date.parse(checkedAt) - Date.parse(incident.openedAt);
    if (downtimeMs < monitor.notificationGraceSec * 1000) return;

    await this.deliverDownNotification(monitor, checkedAt, error);
  }

  private async deliverDownNotification(
    monitor: MonitorRecord,
    checkedAt: string,
    error: string | null,
  ) {
    const result = await this.deliverMonitorNotifications(
      monitor,
      "down",
      checkedAt,
      error,
    );
    if (result.delivered) {
      await this.db.monitor.markDownNotificationDelivered(
        monitor.id,
        checkedAt,
      );
    }
  }

  private async deliverMonitorNotifications(
    monitor: MonitorRecord,
    status: "up" | "down",
    checkedAt: string,
    error: string | null,
  ) {
    const destinations = (
      await this.db.notification.getForMonitor(monitor.id)
    ).slice(0, MAX_MONITOR_NOTIFICATION_DESTINATIONS);
    return dispatchNotificationEvent(destinations, {
      kind: "transition",
      monitor,
      status,
      checkedAt,
      error,
    });
  }
}

function buildCronHeartbeatOverdueMessage(monitor: MonitorRecord) {
  const baseline = Date.parse(monitor.lastCheckedAt ?? monitor.createdAt);
  const expectedAt = getNextCronHeartbeatExpectedAt(monitor, baseline);
  const schedule = getCronHeartbeatSchedule(monitor);
  return `No heartbeat received for the ${new Date(expectedAt).toISOString()} schedule within ${schedule.graceSec}s`;
}
