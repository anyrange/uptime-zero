import { DurableObject } from "cloudflare:workers";

import { createDatabase } from "@/server/db";
import {
  deliverPendingNotifications,
  nextNotificationDueAt,
} from "@/server/services/notifications/outbox";

export class NotificationActor extends DurableObject<Env> {
  async sync() {
    const dueAt = await nextNotificationDueAt(createDatabase(this.env.DB));

    if (dueAt === null) return;
    const next = Math.max(Date.now() + 1000, dueAt);
    const existing = await this.ctx.storage.getAlarm();

    if (existing === null || existing > next)
      await this.ctx.storage.setAlarm(next);
  }

  override async alarm() {
    // Keep a durable wakeup before external I/O; cron also repairs missed producer wakeups.
    await this.ctx.storage.setAlarm(Date.now() + 30000);
    const db = createDatabase(this.env.DB);
    await deliverPendingNotifications(db);
    const next = await nextNotificationDueAt(db);

    if (next === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, next));
  }
}
