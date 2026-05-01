import { and, desc, eq, or, sql } from "drizzle-orm";

import type { IncidentListFilters } from "@/types";

import { schema, type AppDrizzleDb } from "@/api/db";
import { mapIncidentListRecord } from "@/api/db/normalize";

const INCIDENTS_INDEX_LIMIT = 100;

export class IncidentModel {
  constructor(private readonly db: AppDrizzleDb) {}

  async list(filters: IncidentListFilters) {
    const queryText = filters.query?.trim().toLowerCase();
    const conditions = [
      filters.status === "open"
        ? eq(schema.incidents.status, "open")
        : filters.status === "closed"
          ? eq(schema.incidents.status, "closed")
          : undefined,
      filters.monitorId
        ? eq(schema.incidents.monitorId, filters.monitorId)
        : undefined,
      queryText
        ? or(
            sql`lower(${schema.incidents.title}) like ${`%${queryText}%`}`,
            sql`lower(coalesce(${schema.incidents.body}, '')) like ${`%${queryText}%`}`,
            sql`lower(${schema.monitors.name}) like ${`%${queryText}%`}`,
          )
        : undefined,
    ].filter(Boolean);

    const rows = await this.db
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
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        sql`CASE ${schema.incidents.status} WHEN 'open' THEN 0 ELSE 1 END`,
        desc(schema.incidents.openedAt),
      )
      .limit(INCIDENTS_INDEX_LIMIT);

    return rows.map(mapIncidentListRecord);
  }
}
