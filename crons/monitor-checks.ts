import { defineScheduled } from "void";
import { logger } from "void/log";

import * as monitors from "@/modules/monitors/monitors.service";
import * as notifications from "@/modules/notifications/notifications.service";

export const cron = "* * * * *";

// One invocation must stay inside Worker subrequest limits: a check makes at
// most two probe requests, so 20 checks fit the Workers Free budget. Due
// monitors beyond the cap run first on the next minute.
const MAX_CHECKS_PER_RUN = 20;

const CHECK_CONCURRENCY = 5;

/**
 * The scheduler: runs every due check, earliest first, then sends the alerts
 * those checks committed. Void can't host Durable Object alarms or queue
 * producers for framework apps, so a per-minute cron drives checks.
 */
export default defineScheduled(async () => {
  const due = await monitors.due();
  const batch = due.slice(0, MAX_CHECKS_PER_RUN);
  const outcomes: Array<monitors.ScheduledCheckOutcome> = [];

  // A few workers pull from one shared iterator, so at most
  // CHECK_CONCURRENCY checks are in flight.
  const queue = batch.values();

  await Promise.all(
    Array.from({ length: CHECK_CONCURRENCY }, async () => {
      for (const monitor of queue) {
        outcomes.push(await monitors.runScheduledCheck(monitor.id));
      }
    }),
  );

  await notifications.deliverDue();

  logger.info("monitor checks ran", {
    due: due.length,
    checked: outcomes.filter((outcome) => outcome === "checked").length,
    failed: outcomes.filter((outcome) => outcome === "failed").length,
    deferred: due.length - batch.length,
  });
});
