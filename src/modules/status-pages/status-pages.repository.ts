import "@tanstack/react-start/server-only";
import * as schema from "@schema";
import dayjs from "dayjs";
import { and, asc, count, db, eq, gte, inArray, sql } from "void/db";

import type { StatusPage, StatusPageInput } from "@/lib/schemas/status-pages";

/**
 * Persistence for status pages and their monitor links, plus the aggregate
 * queries behind public pages. Aggregates read daily rollups so their cost
 * depends on monitors and days, never on the number of checks.
 */

export type UptimeCutoffs = {
  /** ISO timestamps; rollup queries compare their date part. */
  readonly since: string;
  readonly day: string;
  readonly week: string;
  readonly month: string;
};

async function linkedMonitorIds(statusPageId: string) {
  const rows = await db
    .select({ monitorId: schema.statusPageMonitors.monitorId })
    .from(schema.statusPageMonitors)
    .where(eq(schema.statusPageMonitors.statusPageId, statusPageId))
    // Links are inserted in the order the user arranged them.
    .orderBy(sql`rowid`);

  return rows.map((row) => row.monitorId);
}

export async function findById(id: string) {
  const [page] = await db
    .select()
    .from(schema.statusPages)
    .where(eq(schema.statusPages.id, id));

  if (!page) return null;

  return { page, monitorIds: await linkedMonitorIds(id) };
}

export async function findPublishedBySlug(slug: string) {
  const [page] = await db
    .select()
    .from(schema.statusPages)
    .where(
      and(
        eq(schema.statusPages.slug, slug),
        eq(schema.statusPages.published, true),
      ),
    );

  return page ?? null;
}

export async function list() {
  return db
    .select()
    .from(schema.statusPages)
    .orderBy(asc(schema.statusPages.createdAt));
}

export async function listLinks() {
  return db.select().from(schema.statusPageMonitors);
}

/** Inserts or replaces a page and its ordered monitor links. */
export async function save(input: StatusPageInput, existingId?: string) {
  const now = dayjs().toISOString();
  const id = existingId ?? crypto.randomUUID();
  const { monitorIds, ...values } = input;

  // One insert per link keeps every statement below D1's parameter limit.
  await db.batch([
    existingId
      ? db
          .update(schema.statusPages)
          .set({ ...values, updatedAt: now })
          .where(eq(schema.statusPages.id, id))
      : db
          .insert(schema.statusPages)
          .values({ ...values, id, createdAt: now, updatedAt: now }),
    db
      .delete(schema.statusPageMonitors)
      .where(eq(schema.statusPageMonitors.statusPageId, id)),
    ...[...new Set(monitorIds)].map((monitorId) =>
      db
        .insert(schema.statusPageMonitors)
        .values({ statusPageId: id, monitorId }),
    ),
  ]);

  return id;
}

export async function remove(id: string) {
  await db.delete(schema.statusPages).where(eq(schema.statusPages.id, id));
}

/** Monitors linked to a page; targets are only read when published. */
export async function publicMonitors(page: StatusPage) {
  return db
    .select({
      id: schema.monitors.id,
      name: schema.monitors.name,
      kind: schema.monitors.kind,
      lastStatus: schema.monitors.lastStatus,
      updatedAt: schema.monitors.updatedAt,
      target: page.showTarget
        ? sql<string | null>`${schema.monitors.target}`
        : sql<string | null>`null`,
    })
    .from(schema.monitors)
    .innerJoin(
      schema.statusPageMonitors,
      eq(schema.monitors.id, schema.statusPageMonitors.monitorId),
    )
    .where(eq(schema.statusPageMonitors.statusPageId, page.id));
}

/** Up/down/unknown counts per monitor and day since `since`. */
export async function dailyCounts(
  monitorIds: ReadonlyArray<string>,
  since: string,
) {
  const ids = [...monitorIds];

  const rollups = await db
    .select({
      monitorId: schema.heartbeatDaily.monitorId,
      day: schema.heartbeatDaily.day,
      up: sql<number>`coalesce(sum(${schema.heartbeatDaily.up}), 0)`.mapWith(
        Number,
      ),
      down: sql<number>`coalesce(sum(${schema.heartbeatDaily.down}), 0)`.mapWith(
        Number,
      ),
      unknown:
        sql<number>`coalesce(sum(${schema.heartbeatDaily.unknown}), 0)`.mapWith(
          Number,
        ),
    })
    .from(schema.heartbeatDaily)
    .where(
      and(
        inArray(schema.heartbeatDaily.monitorId, ids),
        gte(schema.heartbeatDaily.day, since.slice(0, 10)),
      ),
    )
    .groupBy(schema.heartbeatDaily.monitorId, schema.heartbeatDaily.day);

  if (rollups.length > 0) return rollups;

  // Rollups are missing for history recorded before they existed.
  return db
    .select({
      monitorId: schema.heartbeats.monitorId,
      day: sql<string>`substr(${schema.heartbeats.createdAt}, 1, 10)`,
      up: sql<number>`sum(case when ${eq(schema.heartbeats.status, "up")} then 1 else 0 end)`.mapWith(
        Number,
      ),
      down: sql<number>`sum(case when ${eq(schema.heartbeats.status, "down")} then 1 else 0 end)`.mapWith(
        Number,
      ),
      unknown:
        sql<number>`sum(case when ${eq(schema.heartbeats.status, "unknown")} then 1 else 0 end)`.mapWith(
          Number,
        ),
    })
    .from(schema.heartbeats)
    .where(
      and(
        inArray(schema.heartbeats.monitorId, ids),
        gte(schema.heartbeats.createdAt, since),
      ),
    )
    .groupBy(
      schema.heartbeats.monitorId,
      sql<string>`substr(${schema.heartbeats.createdAt}, 1, 10)`,
    );
}

/** Total, day, week and month uptime counts per monitor. */
export async function uptimeCounts(
  monitorIds: ReadonlyArray<string>,
  cutoffs: UptimeCutoffs,
) {
  const ids = [...monitorIds];
  const daily = schema.heartbeatDaily;
  const fromDay = (iso: string) => gte(daily.day, iso.slice(0, 10));

  const rollups = await db
    .select({
      monitorId: daily.monitorId,
      total: sql<number>`coalesce(sum(${daily.total}), 0)`.mapWith(Number),
      up: sql<number>`coalesce(sum(${daily.up}), 0)`.mapWith(Number),
      dayTotal:
        sql<number>`sum(case when ${fromDay(cutoffs.day)} then ${daily.total} else 0 end)`.mapWith(
          Number,
        ),
      dayUp:
        sql<number>`sum(case when ${fromDay(cutoffs.day)} then ${daily.up} else 0 end)`.mapWith(
          Number,
        ),
      weekTotal:
        sql<number>`sum(case when ${fromDay(cutoffs.week)} then ${daily.total} else 0 end)`.mapWith(
          Number,
        ),
      weekUp:
        sql<number>`sum(case when ${fromDay(cutoffs.week)} then ${daily.up} else 0 end)`.mapWith(
          Number,
        ),
      monthTotal:
        sql<number>`sum(case when ${fromDay(cutoffs.month)} then ${daily.total} else 0 end)`.mapWith(
          Number,
        ),
      monthUp:
        sql<number>`sum(case when ${fromDay(cutoffs.month)} then ${daily.up} else 0 end)`.mapWith(
          Number,
        ),
    })
    .from(daily)
    .where(and(inArray(daily.monitorId, ids), fromDay(cutoffs.since)))
    .groupBy(daily.monitorId);

  if (rollups.length > 0) return rollups;

  // Rollups are missing for history recorded before they existed.
  const heartbeats = schema.heartbeats;
  const isUp = eq(heartbeats.status, "up");
  const since = (iso: string) => gte(heartbeats.createdAt, iso);

  return db
    .select({
      monitorId: heartbeats.monitorId,
      total: count(),
      up: sql<number>`sum(case when ${isUp} then 1 else 0 end)`.mapWith(Number),
      dayTotal:
        sql<number>`sum(case when ${since(cutoffs.day)} then 1 else 0 end)`.mapWith(
          Number,
        ),
      dayUp:
        sql<number>`sum(case when ${and(since(cutoffs.day), isUp)!} then 1 else 0 end)`.mapWith(
          Number,
        ),
      weekTotal:
        sql<number>`sum(case when ${since(cutoffs.week)} then 1 else 0 end)`.mapWith(
          Number,
        ),
      weekUp:
        sql<number>`sum(case when ${and(since(cutoffs.week), isUp)!} then 1 else 0 end)`.mapWith(
          Number,
        ),
      monthTotal:
        sql<number>`sum(case when ${since(cutoffs.month)} then 1 else 0 end)`.mapWith(
          Number,
        ),
      monthUp:
        sql<number>`sum(case when ${and(since(cutoffs.month), isUp)!} then 1 else 0 end)`.mapWith(
          Number,
        ),
    })
    .from(heartbeats)
    .where(and(inArray(heartbeats.monitorId, ids), since(cutoffs.since)))
    .groupBy(heartbeats.monitorId);
}
