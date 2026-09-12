import { and, count, eq, lt } from "drizzle-orm";

import { schema, type DrizzleDatabase } from "@/server/db";
import { countWhere, dayFromIso } from "@/server/db/expressions";

export class MaintenanceModel {
  constructor(private readonly db: DrizzleDatabase) {}

  deleteHeartbeatsBefore(cutoff: string) {
    return this.db
      .delete(schema.heartbeats)
      .where(lt(schema.heartbeats.createdAt, cutoff));
  }

  deleteHeartbeatDailyBefore(cutoff: string) {
    return this.db
      .delete(schema.heartbeatDaily)
      .where(lt(schema.heartbeatDaily.day, cutoff.slice(0, 10)));
  }

  backfillHeartbeatDaily() {
    return this.db
      .insert(schema.heartbeatDaily)
      .select(
        this.db
          .select({
            monitorId: schema.heartbeats.monitorId,
            day: dayFromIso(schema.heartbeats.createdAt).as("day"),
            total: count().as("total"),
            up: countWhere(eq(schema.heartbeats.status, "up")).as("up"),
            down: countWhere(eq(schema.heartbeats.status, "down")).as("down"),
            unknown: countWhere(eq(schema.heartbeats.status, "unknown")).as(
              "unknown",
            ),
          })
          .from(schema.heartbeats)
          .groupBy(
            schema.heartbeats.monitorId,
            dayFromIso(schema.heartbeats.createdAt),
          ),
      )
      .onConflictDoNothing();
  }

  deleteClosedIncidentsBefore(cutoff: string) {
    return this.db
      .delete(schema.incidents)
      .where(
        and(
          eq(schema.incidents.status, "closed"),
          lt(schema.incidents.closedAt, cutoff),
        ),
      );
  }

  deleteExpiredSessionsBefore(cutoffMs: number) {
    return this.db
      .delete(schema.session)
      .where(lt(schema.session.expiresAt, new Date(cutoffMs)));
  }

  deleteAllHeartbeats() {
    return this.db.delete(schema.heartbeats);
  }
}
