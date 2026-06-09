import { sql } from "drizzle-orm";

import { schema, type DrizzleDatabase } from "@/server/db";

export class MaintenanceModel {
  constructor(private readonly db: DrizzleDatabase) {}

  deleteHeartbeatsBefore(cutoff: string) {
    return this.db
      .delete(schema.heartbeats)
      .where(sql`${schema.heartbeats.createdAt} < ${cutoff}`);
  }

  deleteClosedIncidentsBefore(cutoff: string) {
    return this.db
      .delete(schema.incidents)
      .where(
        sql`${schema.incidents.status} = 'closed' AND ${schema.incidents.closedAt} < ${cutoff}`,
      );
  }

  deleteExpiredSessionsBefore(cutoffMs: number) {
    return this.db
      .delete(schema.session)
      .where(sql`${schema.session.expiresAt} < ${cutoffMs}`);
  }

  deleteAllHeartbeats() {
    return this.db.delete(schema.heartbeats);
  }
}
