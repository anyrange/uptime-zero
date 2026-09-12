import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";

import type { Database } from "@/server/db";

import { schema } from "@/server/db";
import { deliverNotificationDestination } from "@/server/services/notifications/delivery";

export async function deliverPendingNotifications(
  db: Database,
  fetchImpl: typeof fetch = fetch,
) {
  const rows = await db.drizzle
    .select()
    .from(schema.notificationDeliveries)
    .where(
      and(
        isNull(schema.notificationDeliveries.deliveredAt),
        lte(schema.notificationDeliveries.dueAt, Date.now()),
      ),
    )
    .orderBy(
      asc(schema.notificationDeliveries.dueAt),
      asc(schema.notificationDeliveries.id),
    )
    .limit(2);

  await Promise.all(
    rows.map(async (delivery) => {
      try {
        const destination = await db.notification.getById(
          delivery.destinationId,
        );

        const monitor = await db.monitor.getById(delivery.monitorId);

        if (!destination || !monitor) return;

        await deliverNotificationDestination(
          destination,
          {
            kind: "transition",
            monitor,
            status: delivery.status,
            checkedAt: delivery.checkedAt,
            error: delivery.error,
          },
          fetchImpl,
        );
        const deliveredAt = new Date().toISOString();

        const mark = db.drizzle
          .update(schema.notificationDeliveries)
          .set({ deliveredAt })
          .where(eq(schema.notificationDeliveries.id, delivery.id));

        if (delivery.status === "down") {
          // A monitor may recover during delivery. Commit its recovery intent with the acknowledgement.
          const recovery = db.drizzle
            .insert(schema.notificationDeliveries)
            .select(
              db.drizzle
                .select({
                  id: sql<string>`${delivery.incidentId + ":" + delivery.destinationId + ":up"}`.as(
                    "id",
                  ),
                  incidentId: schema.incidents.id,
                  destinationId: sql<string>`${delivery.destinationId}`.as(
                    "destinationId",
                  ),
                  monitorId: schema.incidents.monitorId,
                  status: sql<"up">`'up'`.as("status"),
                  checkedAt: sql<string>`${schema.incidents.closedAt}`.as(
                    "checkedAt",
                  ),
                  error: sql<null>`null`.as("error"),
                  dueAt: sql<number>`${Date.now()}`.as("dueAt"),
                  attempts: sql<number>`0`.as("attempts"),
                  deliveredAt: sql<null>`null`.as("deliveredAt"),
                })
                .from(schema.incidents)
                .where(
                  and(
                    eq(schema.incidents.id, delivery.incidentId),
                    eq(schema.incidents.status, "closed"),
                  ),
                ),
            )
            .onConflictDoNothing();

          await db.drizzle.batch([mark, recovery]);
        } else {
          await mark;
        }
      } catch (error) {
        const attempts = delivery.attempts + 1;
        await db.drizzle
          .update(schema.notificationDeliveries)
          .set({
            attempts,
            dueAt:
              Date.now() +
              Math.min(3600000, 30000 * 2 ** Math.min(attempts - 1, 7)),
          })
          .where(eq(schema.notificationDeliveries.id, delivery.id));
        console.error({
          message: "notification delivery will retry",
          deliveryId: delivery.id,
          attempts,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );
}

export async function nextNotificationDueAt(db: Database) {
  const row = await db.drizzle
    .select({ dueAt: schema.notificationDeliveries.dueAt })
    .from(schema.notificationDeliveries)
    .where(isNull(schema.notificationDeliveries.deliveredAt))
    .orderBy(asc(schema.notificationDeliveries.dueAt))
    .limit(1)
    .get();

  return row?.dueAt ?? null;
}
