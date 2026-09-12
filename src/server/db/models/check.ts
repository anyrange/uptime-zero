import {
  and,
  eq,
  exists,
  gt,
  isNotNull,
  isNull,
  notExists,
  sql,
} from "drizzle-orm";

import type { DrizzleDatabase } from "@/server/db";
import type {
  HeartbeatRecord,
  MonitorCheckResult,
  MonitorRecord,
} from "@/types";

import { schema } from "@/server/db";

export class CheckModel {
  constructor(private readonly db: DrizzleDatabase) {}

  async persist(
    monitor: MonitorRecord,
    result: MonitorCheckResult,
    source: HeartbeatRecord["source"],
    checkedAt: string,
  ) {
    const heartbeatId = crypto.randomUUID();

    const open = await this.db
      .select()
      .from(schema.incidents)
      .where(
        and(
          eq(schema.incidents.monitorId, monitor.id),
          eq(schema.incidents.status, "open"),
        ),
      )
      .get();

    const incidentId = open?.id ?? crypto.randomUUID();

    // The receipt guards the whole batch against edits, pauses and deletion while a check was in flight.
    const accepted = exists(
      this.db
        .select({ id: schema.heartbeats.id })
        .from(schema.heartbeats)
        .where(eq(schema.heartbeats.id, heartbeatId)),
    );

    const day = checkedAt.slice(0, 10);

    const heartbeat = this.db.insert(schema.heartbeats).select(
      this.db
        .select({
          id: sql<string>`${heartbeatId}`.as("id"),
          monitorId: schema.monitors.id,
          status: sql<string>`${result.status}`.as("status"),
          statusCode: sql<number | null>`${result.statusCode}`.as("statusCode"),
          durationMs: sql<number>`${result.durationMs}`.as("durationMs"),
          error: sql<string | null>`${result.error}`.as("error"),
          createdAt: sql<string>`${checkedAt}`.as("createdAt"),
          source: sql<string>`${source}`.as("source"),
        })
        .from(schema.monitors)
        .where(
          and(
            eq(schema.monitors.id, monitor.id),
            eq(schema.monitors.active, 1),
            eq(schema.monitors.revision, monitor.revision),
          ),
        ),
    );

    const state = this.db
      .update(schema.monitors)
      .set({
        lastStatus: result.status,
        lastCheckedAt: checkedAt,
        lastDurationMs: result.durationMs,
        lastError: result.error,
        updatedAt: checkedAt,
        retryAt: null,
        revision: sql`${schema.monitors.revision} + 1`,
      })
      .where(and(eq(schema.monitors.id, monitor.id), accepted));

    const daily = this.db
      .insert(schema.heartbeatDaily)
      .select(
        this.db
          .select({
            monitorId: schema.monitors.id,
            day: sql<string>`${day}`.as("day"),
            total: sql<number>`1`.as("total"),
            up: sql<number>`${result.status === "up" ? 1 : 0}`.as("up"),
            down: sql<number>`${result.status === "down" ? 1 : 0}`.as("down"),
            unknown: sql<number>`${result.status === "unknown" ? 1 : 0}`.as(
              "unknown",
            ),
          })
          .from(schema.monitors)
          .where(and(eq(schema.monitors.id, monitor.id), accepted)),
      )
      .onConflictDoUpdate({
        target: [schema.heartbeatDaily.monitorId, schema.heartbeatDaily.day],
        set: {
          total: sql`${schema.heartbeatDaily.total} + 1`,
          up: sql`${schema.heartbeatDaily.up} + ${result.status === "up" ? 1 : 0}`,
          down: sql`${schema.heartbeatDaily.down} + ${result.status === "down" ? 1 : 0}`,
          unknown: sql`${schema.heartbeatDaily.unknown} + ${result.status === "unknown" ? 1 : 0}`,
        },
      });

    if (result.status === "down") {
      const incident = this.db.insert(schema.incidents).select(
        this.db
          .select({
            id: sql<string>`${incidentId}`.as("id"),
            monitorId: schema.monitors.id,
            title: sql<string>`${monitor.name + " is down"}`.as("title"),
            status: sql<string>`'open'`.as("status"),
            body: sql<string | null>`${result.error}`.as("body"),
            pinned: sql<number>`0`.as("pinned"),
            openedAt: sql<string>`${checkedAt}`.as("openedAt"),
            closedAt: sql<null>`null`.as("closedAt"),
          })
          .from(schema.monitors)
          .where(
            and(
              eq(schema.monitors.id, monitor.id),
              accepted,
              notExists(
                this.db
                  .select({ id: schema.incidents.id })
                  .from(schema.incidents)
                  .where(eq(schema.incidents.id, incidentId)),
              ),
            ),
          ),
      );

      const deliveries = this.db
        .insert(schema.notificationDeliveries)
        .select(
          this.db
            .select({
              id: sql<string>`${incidentId} || ':' || ${schema.monitorNotificationDestinations.notificationDestinationId} || ':down'`.as(
                "id",
              ),
              incidentId: sql<string>`${incidentId}`.as("incidentId"),
              destinationId:
                schema.monitorNotificationDestinations
                  .notificationDestinationId,
              monitorId: schema.monitorNotificationDestinations.monitorId,
              status: sql<"down">`'down'`.as("status"),
              checkedAt: sql<string>`${open?.openedAt ?? checkedAt}`.as(
                "checkedAt",
              ),
              error: sql<string | null>`${result.error}`.as("error"),
              dueAt:
                sql<number>`${Date.parse(open?.openedAt ?? checkedAt) + monitor.notificationGraceSec * 1000}`.as(
                  "dueAt",
                ),
              attempts: sql<number>`0`.as("attempts"),
              deliveredAt: sql<null>`null`.as("deliveredAt"),
            })
            .from(schema.monitorNotificationDestinations)
            .where(
              and(
                eq(
                  schema.monitorNotificationDestinations.monitorId,
                  monitor.id,
                ),
                accepted,
              ),
            ),
        )
        .onConflictDoNothing();

      await this.db.batch([heartbeat, state, daily, incident, deliveries]);

      return;
    }

    if (result.status === "up" && open) {
      // Recovery is sent only to destinations that actually received the down event.
      const recovery = this.db
        .insert(schema.notificationDeliveries)
        .select(
          this.db
            .select({
              id: sql<string>`${incidentId} || ':' || ${schema.notificationDeliveries.destinationId} || ':up'`.as(
                "id",
              ),
              incidentId: schema.notificationDeliveries.incidentId,
              destinationId: schema.notificationDeliveries.destinationId,
              monitorId: schema.notificationDeliveries.monitorId,
              status: sql<"up">`'up'`.as("status"),
              checkedAt: sql<string>`${checkedAt}`.as("checkedAt"),
              error: sql<null>`null`.as("error"),
              dueAt: sql<number>`${Date.parse(checkedAt)}`.as("dueAt"),
              attempts: sql<number>`0`.as("attempts"),
              deliveredAt: sql<null>`null`.as("deliveredAt"),
            })
            .from(schema.notificationDeliveries)
            .where(
              and(
                eq(schema.notificationDeliveries.incidentId, incidentId),
                eq(schema.notificationDeliveries.status, "down"),
                isNotNull(schema.notificationDeliveries.deliveredAt),
                accepted,
              ),
            ),
        )
        .onConflictDoNothing();

      const cancelPending = this.db
        .delete(schema.notificationDeliveries)
        .where(
          and(
            eq(schema.notificationDeliveries.incidentId, incidentId),
            eq(schema.notificationDeliveries.status, "down"),
            isNull(schema.notificationDeliveries.deliveredAt),
            gt(schema.notificationDeliveries.dueAt, Date.parse(checkedAt)),
            eq(schema.notificationDeliveries.attempts, 0),
            accepted,
          ),
        );

      const close = this.db
        .update(schema.incidents)
        .set({ status: "closed", closedAt: checkedAt })
        .where(and(eq(schema.incidents.id, incidentId), accepted));

      await this.db.batch([
        heartbeat,
        state,
        daily,
        recovery,
        cancelPending,
        close,
      ]);

      return;
    }

    await this.db.batch([heartbeat, state, daily]);
  }
}
