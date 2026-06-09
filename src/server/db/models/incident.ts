import { and, desc, eq, inArray, or, sql } from "drizzle-orm";

import type {
  IncidentListFilters,
  IncidentListRecord,
  IncidentRecord,
} from "@/types";

import { schema, type DrizzleDatabase } from "@/server/db";
import {
  readIncidentStatus,
  readMonitorKind,
  readMonitorStatus,
} from "@/server/db/values";

const INCIDENTS_INDEX_LIMIT = 100;

type IncidentRow = typeof schema.incidents.$inferSelect;
type IncidentListRecordRow = Omit<
  IncidentListRecord,
  "status" | "monitorKind" | "monitorLastStatus"
> & {
  status: string;
  monitorKind: string;
  monitorLastStatus: string;
};

export class IncidentModel {
  constructor(private readonly db: DrizzleDatabase) {}

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

  async countOpen() {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.incidents)
      .where(eq(schema.incidents.status, "open"));
    return rows[0]?.count ?? 0;
  }

  async listForMonitor(monitorId: string, limit: number) {
    const rows = await this.db
      .select()
      .from(schema.incidents)
      .where(eq(schema.incidents.monitorId, monitorId))
      .orderBy(desc(schema.incidents.openedAt))
      .limit(limit);
    return rows.map(mapIncidentRecord);
  }

  async listRecent(limit: number) {
    const rows = await this.db
      .select()
      .from(schema.incidents)
      .orderBy(
        sql`CASE ${schema.incidents.status} WHEN 'open' THEN 0 ELSE 1 END`,
        desc(schema.incidents.openedAt),
      )
      .limit(limit);
    return rows.map(mapIncidentRecord);
  }

  async listForMonitors(monitorIds: string[], limit: number) {
    if (monitorIds.length === 0) {
      return [];
    }
    const rows = await this.db
      .select()
      .from(schema.incidents)
      .where(inArray(schema.incidents.monitorId, monitorIds))
      .orderBy(desc(schema.incidents.openedAt))
      .limit(limit);
    return rows.map(mapIncidentRecord);
  }

  async getOpenForMonitor(monitorId: string) {
    return this.db
      .select({
        id: schema.incidents.id,
        openedAt: schema.incidents.openedAt,
      })
      .from(schema.incidents)
      .where(
        and(
          eq(schema.incidents.monitorId, monitorId),
          eq(schema.incidents.status, "open"),
        ),
      )
      .get();
  }

  async openForMonitorIfMissing(payload: {
    monitorId: string;
    title: string;
    body: string | null;
    openedAt: string;
  }) {
    const existing = await this.getOpenForMonitor(payload.monitorId);
    if (existing) {
      return;
    }

    await this.db.insert(schema.incidents).values({
      id: crypto.randomUUID(),
      monitorId: payload.monitorId,
      title: payload.title,
      status: "open",
      body: payload.body,
      pinned: 0,
      openedAt: payload.openedAt,
      closedAt: null,
    });
  }

  closeOpenForMonitor(monitorId: string, closedAt: string) {
    return this.db
      .update(schema.incidents)
      .set({ status: "closed", closedAt })
      .where(
        and(
          eq(schema.incidents.monitorId, monitorId),
          eq(schema.incidents.status, "open"),
        ),
      );
  }

  deleteAll() {
    return this.db.delete(schema.incidents);
  }
}

export function mapIncidentRecord(row: IncidentRow) {
  return {
    ...row,
    status: readIncidentStatus(row.status),
  } satisfies IncidentRecord;
}

export function mapIncidentListRecord(row: IncidentListRecordRow) {
  return {
    ...row,
    monitorKind: readMonitorKind(row.monitorKind),
    monitorLastStatus: readMonitorStatus(row.monitorLastStatus),
    status: readIncidentStatus(row.status),
  } satisfies IncidentListRecord;
}
