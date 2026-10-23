import "@tanstack/react-start/server-only";
import dayjs from "dayjs";

import * as settings from "@/modules/settings/settings.service";

import * as repo from "./maintenance.repository";

/** Daily rollups back the one-year availability window, so keep a year. */
const ROLLUP_RETENTION_DAYS = 366;

/** Housekeeping the daily cron runs. */

/** Deletes checks and closed incidents past retention, and dead sessions. */
export async function applyRetention() {
  const retention = await settings.current();

  await repo.deleteExpired({
    heartbeatsBefore: dayjs()
      .subtract(retention.heartbeatRetentionDays, "day")
      .toISOString(),
    rollupsBefore: dayjs().subtract(ROLLUP_RETENTION_DAYS, "day").toISOString(),
    closedIncidentsBefore: dayjs()
      .subtract(retention.incidentRetentionDays, "day")
      .toISOString(),
    sessionsExpiredBefore: new Date(),
  });
}
