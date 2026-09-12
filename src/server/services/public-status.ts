import { and, eq, gte, sql } from "drizzle-orm";

import type { Database } from "@/server/db";
import type { PublicStatusPageData } from "@/types";

import { schema } from "@/server/db";
import { readMonitorKind, readMonitorStatus } from "@/server/db/values";
import { daysAgoIso } from "@/server/lib/dates";
import { computeAggregateStatus } from "@/server/lib/monitoring";

export async function getPublicStatus(db: Database, slug: string) {
  const page = await db.statusPage.getPublishedBySlug(slug);

  if (!page) return null;

  const settings = await db.settings.get();
  const historyDays = Math.min(settings.heartbeatRetentionDays, 365);
  const cutoff = daysAgoIso(historyDays);
  const linked = eq(schema.statusPageMonitors.statusPageId, page.id);

  const monitors = await db.drizzle
    .select({
      id: schema.monitors.id,
      name: schema.monitors.name,
      kind: schema.monitors.kind,
      lastStatus: schema.monitors.lastStatus,
      updatedAt: schema.monitors.updatedAt,
      target: page.showTarget === 1 ? schema.monitors.target : sql<null>`null`,
    })
    .from(schema.monitors)
    .innerJoin(
      schema.statusPageMonitors,
      eq(schema.monitors.id, schema.statusPageMonitors.monitorId),
    )
    .where(linked);

  // Aggregate in D1 so response size depends on monitors and days, never checks.
  const history =
    page.showHistory === 1
      ? await db.drizzle
          .select({
            monitorId: schema.heartbeats.monitorId,
            day: sql<string>`substr(${schema.heartbeats.createdAt}, 1, 10)`,
            up: sql<number>`sum(${schema.heartbeats.status} = 'up')`,
            down: sql<number>`sum(${schema.heartbeats.status} = 'down')`,
            unknown: sql<number>`sum(${schema.heartbeats.status} = 'unknown')`,
          })
          .from(schema.heartbeats)
          .innerJoin(
            schema.statusPageMonitors,
            eq(
              schema.heartbeats.monitorId,
              schema.statusPageMonitors.monitorId,
            ),
          )
          .where(and(linked, gte(schema.heartbeats.createdAt, cutoff)))
          .groupBy(
            schema.heartbeats.monitorId,
            sql`substr(${schema.heartbeats.createdAt}, 1, 10)`,
          )
      : [];

  const uptime = await db.drizzle
    .select({
      monitorId: schema.heartbeats.monitorId,
      total: sql<number>`count(*)`,
      up: sql<number>`sum(${schema.heartbeats.status} = 'up')`,
      dayTotal: sql<number>`sum(${schema.heartbeats.createdAt} >= ${daysAgoIso(1)})`,
      dayUp: sql<number>`sum(${schema.heartbeats.createdAt} >= ${daysAgoIso(1)} and ${schema.heartbeats.status} = 'up')`,
      weekTotal: sql<number>`sum(${schema.heartbeats.createdAt} >= ${daysAgoIso(7)})`,
      weekUp: sql<number>`sum(${schema.heartbeats.createdAt} >= ${daysAgoIso(7)} and ${schema.heartbeats.status} = 'up')`,
      monthTotal: sql<number>`sum(${schema.heartbeats.createdAt} >= ${daysAgoIso(30)})`,
      monthUp: sql<number>`sum(${schema.heartbeats.createdAt} >= ${daysAgoIso(30)} and ${schema.heartbeats.status} = 'up')`,
    })
    .from(schema.heartbeats)
    .innerJoin(
      schema.statusPageMonitors,
      eq(schema.heartbeats.monitorId, schema.statusPageMonitors.monitorId),
    )
    .where(
      and(
        linked,
        gte(schema.heartbeats.createdAt, daysAgoIso(Math.min(historyDays, 90))),
      ),
    )
    .groupBy(schema.heartbeats.monitorId);

  const incidents = await db.incident.listForMonitors(
    monitors.map((monitor) => monitor.id),
    10,
  );

  return {
    page,
    monitors: monitors.map((monitor) => ({
      ...monitor,
      kind: readMonitorKind(monitor.kind),
      lastStatus: readMonitorStatus(monitor.lastStatus),
    })),
    // Internal check errors may contain private targets or assertion values.
    incidents: incidents.map((incident) => ({ ...incident, body: null })),
    history,
    uptime,
    historyDays,
    status: computeAggregateStatus(
      monitors.map((monitor) => readMonitorStatus(monitor.lastStatus)),
    ),
  } satisfies PublicStatusPageData;
}
