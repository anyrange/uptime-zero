import type { Database } from "@/server/db";
import type {
  HeartbeatRecord,
  MonitorCheckResult,
  MonitorRecord,
} from "@/types";

import { nowIso } from "@/server/lib/dates";
import { runConfiguredMonitorCheck } from "@/server/lib/monitoring";
import {
  getCronHeartbeatSchedule,
  getNextCronHeartbeatExpectedAt,
} from "@/server/lib/monitoring-cron";

export class MonitorLifecycle {
  constructor(private readonly db: Database) {}

  async runPollCheck(monitor: MonitorRecord) {
    const result = await runConfiguredMonitorCheck(monitor);
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

  private async persistCheckResult(
    monitor: MonitorRecord,
    result: MonitorCheckResult,
    source: HeartbeatRecord["source"],
    checkedAt = nowIso(),
  ) {
    await this.db.check.persist(monitor, result, source, checkedAt);
  }
}

function buildCronHeartbeatOverdueMessage(monitor: MonitorRecord) {
  const baseline = Date.parse(monitor.lastCheckedAt ?? monitor.createdAt);
  const expectedAt = getNextCronHeartbeatExpectedAt(monitor, baseline);
  const schedule = getCronHeartbeatSchedule(monitor);

  return `No heartbeat received for the ${new Date(expectedAt).toISOString()} schedule within ${schedule.graceSec}s`;
}
