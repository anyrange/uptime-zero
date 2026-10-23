import "@tanstack/react-start/server-only";
import * as schema from "@schema";
import { and, db, eq, lt } from "void/db";

/** Bulk deletes for data that outlived its retention. */

export type RetentionCutoffs = {
  readonly heartbeatsBefore: string;
  readonly rollupsBefore: string;
  readonly closedIncidentsBefore: string;
  readonly sessionsExpiredBefore: Date;
};

export async function deleteExpired(cutoffs: RetentionCutoffs) {
  await db.batch([
    db
      .delete(schema.heartbeats)
      .where(lt(schema.heartbeats.createdAt, cutoffs.heartbeatsBefore)),
    db
      .delete(schema.heartbeatDaily)
      .where(lt(schema.heartbeatDaily.day, cutoffs.rollupsBefore.slice(0, 10))),
    db
      .delete(schema.incidents)
      .where(
        and(
          eq(schema.incidents.status, "closed"),
          lt(schema.incidents.closedAt, cutoffs.closedIncidentsBefore),
        ),
      ),
    db
      .delete(schema.session)
      .where(lt(schema.session.expiresAt, cutoffs.sessionsExpiredBefore)),
  ] as const);
}
