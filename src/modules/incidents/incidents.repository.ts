import "@tanstack/react-start/server-only";
import * as schema from "@schema";
import { and, count, db, desc, eq, inArray, or, sql } from "void/db";

/** Read access to incidents; they are written by the monitors repository's `recordCheck`. */

const INDEX_LIMIT = 100;

export type IncidentQuery = {
  readonly status: "open" | "closed" | "all";
  readonly monitorId?: string;
  readonly text?: string;
};

/** Open incidents first, then newest first; text matches title, body or monitor. */
export async function search(query: IncidentQuery) {
  const text = query.text?.trim().toLowerCase();
  const pattern = `%${text}%`;

  return db
    .select({
      id: schema.incidents.id,
      status: schema.incidents.status,
      title: schema.incidents.title,
      body: schema.incidents.body,
      openedAt: schema.incidents.openedAt,
      closedAt: schema.incidents.closedAt,
      monitorId: schema.monitors.id,
      monitorName: schema.monitors.name,
      monitorKind: schema.monitors.kind,
      monitorLastStatus: schema.monitors.lastStatus,
    })
    .from(schema.incidents)
    .innerJoin(
      schema.monitors,
      eq(schema.monitors.id, schema.incidents.monitorId),
    )
    .where(
      and(
        query.status === "all"
          ? undefined
          : eq(schema.incidents.status, query.status),
        query.monitorId
          ? eq(schema.incidents.monitorId, query.monitorId)
          : undefined,
        text
          ? or(
              sql`lower(${schema.incidents.title}) like ${pattern}`,
              sql`lower(coalesce(${schema.incidents.body}, '')) like ${pattern}`,
              sql`lower(${schema.monitors.name}) like ${pattern}`,
            )
          : undefined,
      ),
    )
    .orderBy(
      sql`CASE ${schema.incidents.status} WHEN 'open' THEN 0 ELSE 1 END`,
      desc(schema.incidents.openedAt),
    )
    .limit(INDEX_LIMIT);
}

export async function countOpen() {
  const [row] = await db
    .select({ count: count() })
    .from(schema.incidents)
    .where(eq(schema.incidents.status, "open"));

  return row?.count ?? 0;
}

export async function listForMonitors(
  monitorIds: ReadonlyArray<string>,
  limit: number,
) {
  if (monitorIds.length === 0) return [];

  return db
    .select()
    .from(schema.incidents)
    .where(inArray(schema.incidents.monitorId, [...monitorIds]))
    .orderBy(desc(schema.incidents.openedAt))
    .limit(limit);
}

/** Open incidents first, then the newest closed ones. */
export async function listRecent(limit: number) {
  const byStatus = (status: "open" | "closed") =>
    db
      .select()
      .from(schema.incidents)
      .where(eq(schema.incidents.status, status))
      .orderBy(desc(schema.incidents.openedAt))
      .limit(limit);

  const [open, closed] = await Promise.all([
    byStatus("open"),
    byStatus("closed"),
  ]);

  return [...open, ...closed].slice(0, limit);
}
