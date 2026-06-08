import { asc, and, eq } from "drizzle-orm";

import type { AppDrizzleDb } from "@/api/db";
import type {
  HeartbeatRecord,
  MonitorCheckResult,
  MonitorRecord,
  MonitorStatus,
} from "@/types";

import { mapNotificationDestinationRecord } from "@/api/db/normalize";
import * as schema from "@/api/db/schema";
import { nowIso } from "@/api/lib/dates";
import {
  mergeHttpAndSslResult,
  probeMonitorSsl,
  runHttpCheck,
} from "@/api/lib/monitoring";
import {
  getCronHeartbeatSchedule,
  getNextCronHeartbeatExpectedAt,
} from "@/api/lib/monitoring-cron";
import { dispatchNotificationEvent } from "@/api/lib/notifications";

export class MonitorLifecycle {
  constructor(private readonly db: AppDrizzleDb) {}

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
    const startedAt = Date.now();
    let result = await runHttpCheck(monitor, fetchImpl);
    for (
      let attempt = 0;
      attempt < monitor.retries && result.status === "down";
      attempt += 1
    ) {
      result = await runHttpCheck(monitor, fetchImpl);
    }
    const remainingTimeoutMs = monitor.timeoutMs - (Date.now() - startedAt);
    if (!monitor.target.startsWith("https://")) {
      return result;
    }
    const sslResult = await probeMonitorSsl(
      monitor.target,
      remainingTimeoutMs,
      Date.now(),
      monitor.sslExpiryWarnDays ?? undefined,
    );
    return mergeHttpAndSslResult(result, sslResult, monitor);
  }

  private async persistCheckResult(
    monitor: MonitorRecord,
    result: MonitorCheckResult,
    source: HeartbeatRecord["source"],
    checkedAt = nowIso(),
  ) {
    await this.insertHeartbeat(monitor, result, source, checkedAt);
    await this.updateMonitorState(
      monitor.id,
      result.status,
      checkedAt,
      result.durationMs,
      result.error,
      result.certValidTo ?? null,
      result.certDaysRemaining ?? null,
      result.hostname ?? null,
      result.sslStatus ?? null,
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
    if (monitor.lastStatus === nextStatus) return;
    if (nextStatus === "down") {
      await this.openIncident(monitor, checkedAt, error);
      await this.deliverMonitorNotifications(monitor, "down", checkedAt, error);
      return;
    }
    if (nextStatus === "up") {
      await this.closeIncidentIfNeeded(monitor.id, checkedAt);
      await this.deliverMonitorNotifications(monitor, "up", checkedAt, null);
    }
  }

  private async insertHeartbeat(
    monitor: MonitorRecord,
    result: MonitorCheckResult,
    source: HeartbeatRecord["source"],
    createdAt: string,
  ) {
    await this.db.insert(schema.heartbeats).values({
      id: crypto.randomUUID(),
      monitorId: monitor.id,
      status: result.status,
      statusCode: result.statusCode,
      durationMs: result.durationMs,
      error: result.error,
      certDaysRemaining: result.certDaysRemaining ?? null,
      createdAt,
      source,
    });
  }

  private async updateMonitorState(
    monitorId: string,
    status: MonitorStatus,
    checkedAt: string,
    durationMs: number,
    error: string | null,
    certValidTo: string | null,
    certDaysRemaining: number | null,
    certHostname: string | null,
    sslStatus: MonitorRecord["lastSslStatus"],
  ) {
    await this.db
      .update(schema.monitors)
      .set({
        lastStatus: status,
        lastCheckedAt: checkedAt,
        lastDurationMs: durationMs,
        lastError: error,
        lastCertValidTo: certValidTo,
        lastCertDaysRemaining: certDaysRemaining,
        lastCertHostname: certHostname,
        lastSslStatus: sslStatus,
        updatedAt: checkedAt,
      })
      .where(eq(schema.monitors.id, monitorId));
  }

  private async openIncident(
    monitor: MonitorRecord,
    openedAt: string,
    error: string | null,
  ) {
    const existing = await this.db
      .select({ id: schema.incidents.id })
      .from(schema.incidents)
      .where(
        and(
          eq(schema.incidents.monitorId, monitor.id),
          eq(schema.incidents.status, "open"),
        ),
      )
      .get();
    if (existing) return;

    await this.db.insert(schema.incidents).values({
      id: crypto.randomUUID(),
      monitorId: monitor.id,
      title: `${monitor.name} is down`,
      status: "open",
      body: error,
      pinned: 0,
      openedAt,
      closedAt: null,
    });
  }

  private async closeIncidentIfNeeded(monitorId: string, closedAt: string) {
    await this.db
      .update(schema.incidents)
      .set({ status: "closed", closedAt })
      .where(
        and(
          eq(schema.incidents.monitorId, monitorId),
          eq(schema.incidents.status, "open"),
        ),
      );
  }

  private async deliverMonitorNotifications(
    monitor: MonitorRecord,
    status: "up" | "down",
    checkedAt: string,
    error: string | null,
  ) {
    const destinations = await this.getNotificationDestinationsForMonitor(
      monitor.id,
    );
    await dispatchNotificationEvent(destinations, {
      kind: "transition",
      monitor,
      status,
      checkedAt,
      error,
    });
  }

  private async getNotificationDestinationsForMonitor(monitorId: string) {
    const rows = await this.db
      .select({
        id: schema.notificationDestinations.id,
        name: schema.notificationDestinations.name,
        provider: schema.notificationDestinations.provider,
        configJson: schema.notificationDestinations.configJson,
        createdAt: schema.notificationDestinations.createdAt,
        updatedAt: schema.notificationDestinations.updatedAt,
      })
      .from(schema.monitorNotificationDestinations)
      .innerJoin(
        schema.notificationDestinations,
        eq(
          schema.notificationDestinations.id,
          schema.monitorNotificationDestinations.notificationDestinationId,
        ),
      )
      .where(eq(schema.monitorNotificationDestinations.monitorId, monitorId))
      .orderBy(asc(schema.notificationDestinations.createdAt));

    return rows.map(mapNotificationDestinationRecord);
  }
}

function buildCronHeartbeatOverdueMessage(monitor: MonitorRecord) {
  const baseline = Date.parse(monitor.lastCheckedAt ?? monitor.createdAt);
  const expectedAt = getNextCronHeartbeatExpectedAt(monitor, baseline);
  const schedule = getCronHeartbeatSchedule(monitor);
  return `No heartbeat received for the ${new Date(expectedAt).toISOString()} schedule within ${schedule.graceSec}s`;
}
