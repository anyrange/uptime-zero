import type { Database } from "@/server/db";

import { nowIso } from "@/server/lib/dates";
import { dispatchNotificationEvent } from "@/server/services/notifications/delivery";

export class NotificationService {
  constructor(private readonly db: Database) {}

  async sendTestNotification(
    destinationId: string,
    fetchImpl: typeof fetch = fetch,
  ) {
    const destination = await this.db.notification.getById(destinationId);
    if (!destination) {
      return false;
    }

    await dispatchNotificationEvent(
      [destination],
      {
        kind: "test",
        sentAt: nowIso(),
        destination: {
          id: destination.id,
          name: destination.name,
          provider: destination.provider,
        },
      },
      fetchImpl,
      { throwOnFailure: true },
    );
    return true;
  }
}
