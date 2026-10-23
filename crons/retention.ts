import { defineScheduled } from "void";
import { logger } from "void/log";

import * as maintenance from "@/modules/maintenance/maintenance.service";

export const cron = "0 2 * * *";

/** Applies the configured heartbeat and incident retention once a day. */
export default defineScheduled(async () => {
  await maintenance.applyRetention();
  logger.info("retention applied");
});
