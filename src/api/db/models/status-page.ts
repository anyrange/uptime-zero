import { all } from "better-all";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { schema, type AppDrizzleDb } from "@/api/db";
import {
  mapHeartbeatRecord,
  mapIncidentRecord,
  mapMonitorRecord,
  mapStatusPageRecord,
  normalizeMonitorStatus,
} from "@/api/db/normalize";
import { nowIso } from "@/api/lib/dates";
import { computeAggregateStatus } from "@/api/lib/monitoring";

export class StatusPageModel {
  constructor(private readonly db: AppDrizzleDb) {}

  async createOrUpdate(payload: {
    id?: string;
    slug: string;
    title: string;
    description?: string | null;
    published: number;
    showHistory: number;
    monitorIds: string[];
  }) {
    const now = nowIso();
    const id = payload.id ?? crypto.randomUUID();
    const monitorIds = [...new Set(payload.monitorIds)];
    const existing = payload.id
      ? await this.db
          .select()
          .from(schema.statusPages)
          .where(eq(schema.statusPages.id, payload.id))
          .get()
      : null;

    if (existing) {
      await this.db
        .update(schema.statusPages)
        .set({
          slug: payload.slug,
          title: payload.title,
          description: payload.description ?? null,
          published: payload.published,
          showHistory: payload.showHistory,
          updatedAt: now,
        })
        .where(eq(schema.statusPages.id, id));
    } else {
      await this.db.insert(schema.statusPages).values({
        id,
        slug: payload.slug,
        title: payload.title,
        description: payload.description ?? null,
        published: payload.published,
        showHistory: payload.showHistory,
        createdAt: now,
        updatedAt: now,
      });
    }

    await this.db
      .delete(schema.statusPageMonitors)
      .where(eq(schema.statusPageMonitors.statusPageId, id));
    if (monitorIds.length > 0) {
      await this.db.insert(schema.statusPageMonitors).values(
        monitorIds.map((monitorId) => ({
          statusPageId: id,
          monitorId,
        })),
      );
    }
  }

  async getById(id: string) {
    const page = await this.db
      .select()
      .from(schema.statusPages)
      .where(eq(schema.statusPages.id, id))
      .get();
    if (!page) {
      return null;
    }
    const links = await this.db
      .select({ monitorId: schema.statusPageMonitors.monitorId })
      .from(schema.statusPageMonitors)
      .where(eq(schema.statusPageMonitors.statusPageId, id))
      .orderBy(sql`rowid`);
    return {
      page: mapStatusPageRecord(page),
      monitorIds: links.map((link) => link.monitorId),
    };
  }

  delete(id: string) {
    return this.db
      .delete(schema.statusPages)
      .where(eq(schema.statusPages.id, id));
  }

  async getPublic(slug: string) {
    const page = await this.db
      .select()
      .from(schema.statusPages)
      .where(
        and(
          eq(schema.statusPages.slug, slug),
          eq(schema.statusPages.published, 1),
        ),
      )
      .get();
    if (!page) {
      return null;
    }

    const links = await this.db
      .select({ monitorId: schema.statusPageMonitors.monitorId })
      .from(schema.statusPageMonitors)
      .where(eq(schema.statusPageMonitors.statusPageId, page.id))
      .orderBy(sql`rowid`);
    const monitorIds = links.map((link) => link.monitorId);

    const { monitors, incidents, heartbeats } = monitorIds.length
      ? await all({
          monitors: () =>
            this.db
              .select()
              .from(schema.monitors)
              .where(inArray(schema.monitors.id, monitorIds))
              .orderBy(asc(schema.monitors.name)),
          incidents: () =>
            this.db
              .select()
              .from(schema.incidents)
              .where(inArray(schema.incidents.monitorId, monitorIds))
              .orderBy(desc(schema.incidents.openedAt))
              .limit(10),
          heartbeats: () => this.listPublicHeartbeatsForMonitors(monitorIds),
        })
      : { monitors: [], incidents: [], heartbeats: [] };

    return {
      page: mapStatusPageRecord(page),
      monitors: monitors.map(mapMonitorRecord),
      incidents: incidents.map(mapIncidentRecord),
      heartbeats: heartbeats.map(mapHeartbeatRecord),
      status: computeAggregateStatus(
        monitors.map((monitor) => normalizeMonitorStatus(monitor.lastStatus)),
      ),
    };
  }

  private async listPublicHeartbeatsForMonitors(monitorIds: string[]) {
    const rowsByMonitor = await Promise.all(
      monitorIds.map((monitorId) =>
        this.db
          .select()
          .from(schema.heartbeats)
          .where(eq(schema.heartbeats.monitorId, monitorId))
          .orderBy(desc(schema.heartbeats.createdAt))
          .limit(45),
      ),
    );

    return rowsByMonitor.flat();
  }
}
