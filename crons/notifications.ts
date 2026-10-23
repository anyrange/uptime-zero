import { defineScheduled } from "void";

import * as notifications from "@/modules/notifications/notifications.service";

export const cron = "* * * * *";

/**
 * Drains due notification intents: alerts whose grace period ended since the
 * last check, and retries with backoff. Fresh transitions are also sent by
 * the `monitor-checks` cron right after the checks that created them.
 */
export default defineScheduled(() => notifications.deliverDue());
