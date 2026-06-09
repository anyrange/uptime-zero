import { and, asc, eq, sql } from "drizzle-orm";

import type { StatusPageRecord } from "@/types";

import { schema, type DrizzleDatabase } from "@/server/db";
import { nowIso } from "@/server/lib/dates";

type StatusPageRow = typeof schema.statusPages.$inferSelect;

export class StatusPageModel {
  constructor(private readonly db: DrizzleDatabase) {}

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

  async list() {
    const rows = await this.db
      .select()
      .from(schema.statusPages)
      .orderBy(asc(schema.statusPages.createdAt));
    return rows.map(mapStatusPageRecord);
  }

  async listLinks() {
    const rows = await this.db.select().from(schema.statusPageMonitors);
    return rows.map((link) => ({
      status_page_id: link.statusPageId,
      monitor_id: link.monitorId,
    }));
  }

  delete(id: string) {
    return this.db
      .delete(schema.statusPages)
      .where(eq(schema.statusPages.id, id));
  }

  deleteAll() {
    return this.db.delete(schema.statusPages);
  }

  deleteAllLinks() {
    return this.db.delete(schema.statusPageMonitors);
  }

  async getPublishedBySlug(slug: string) {
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
    return page ? mapStatusPageRecord(page) : null;
  }

  async getMonitorIds(statusPageId: string) {
    const links = await this.db
      .select({ monitorId: schema.statusPageMonitors.monitorId })
      .from(schema.statusPageMonitors)
      .where(eq(schema.statusPageMonitors.statusPageId, statusPageId))
      .orderBy(sql`rowid`);
    return links.map((link) => link.monitorId);
  }
}

export function mapStatusPageRecord(row: StatusPageRow) {
  return { ...row } satisfies StatusPageRecord;
}
