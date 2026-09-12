import { and, count, eq, gte, inArray, sql } from "drizzle-orm";

import type { Database } from "@/server/db";
import type { PublicStatusPageData } from "@/types";

import { schema } from "@/server/db";
import {
  countWhere,
  dayFromIso,
  sumValues,
  sumWhere,
} from "@/server/db/expressions";
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

  if (monitors.length === 0) {
    return {
      page,
      monitors: [],
      incidents: [],
      history: [],
      uptime: [],
      historyDays,
      status: "unknown",
    } satisfies PublicStatusPageData;
  }

  const monitorIds = monitors.map((monitor) => monitor.id);

  // Aggregate daily rollups so query cost depends on monitors and days, never checks.
  let history =
    page.showHistory === 1
      ? await db.drizzle
          .select({
            monitorId: schema.heartbeatDaily.monitorId,
            day: schema.heartbeatDaily.day,
            up: sumValues(schema.heartbeatDaily.up),
            down: sumValues(schema.heartbeatDaily.down),
            unknown: sumValues(schema.heartbeatDaily.unknown),
          })
          .from(schema.heartbeatDaily)
          .where(
            and(
              inArray(schema.heartbeatDaily.monitorId, monitorIds),
              gte(schema.heartbeatDaily.day, cutoff.slice(0, 10)),
            ),
          )
          .groupBy(schema.heartbeatDaily.monitorId, schema.heartbeatDaily.day)
      : [];

  if (page.showHistory === 1 && history.length === 0) {
    history = await db.drizzle
      .select({
        monitorId: schema.heartbeats.monitorId,
        day: dayFromIso(schema.heartbeats.createdAt),
        up: countWhere(eq(schema.heartbeats.status, "up")),
        down: countWhere(eq(schema.heartbeats.status, "down")),
        unknown: countWhere(eq(schema.heartbeats.status, "unknown")),
      })
      .from(schema.heartbeats)
      .where(
        and(
          inArray(schema.heartbeats.monitorId, monitorIds),
          gte(schema.heartbeats.createdAt, cutoff),
        ),
      )
      .groupBy(
        schema.heartbeats.monitorId,
        dayFromIso(schema.heartbeats.createdAt),
      );
  }

  let uptime = await db.drizzle
    .select({
      monitorId: schema.heartbeatDaily.monitorId,
      total: sumValues(schema.heartbeatDaily.total),
      up: sumValues(schema.heartbeatDaily.up),
      dayTotal: sumWhere(
        schema.heartbeatDaily.total,
        gte(schema.heartbeatDaily.day, daysAgoIso(0).slice(0, 10)),
      ),
      dayUp: sumWhere(
        schema.heartbeatDaily.up,
        gte(schema.heartbeatDaily.day, daysAgoIso(0).slice(0, 10)),
      ),
      weekTotal: sumWhere(
        schema.heartbeatDaily.total,
        gte(schema.heartbeatDaily.day, daysAgoIso(6).slice(0, 10)),
      ),
      weekUp: sumWhere(
        schema.heartbeatDaily.up,
        gte(schema.heartbeatDaily.day, daysAgoIso(6).slice(0, 10)),
      ),
      monthTotal: sumWhere(
        schema.heartbeatDaily.total,
        gte(schema.heartbeatDaily.day, daysAgoIso(29).slice(0, 10)),
      ),
      monthUp: sumWhere(
        schema.heartbeatDaily.up,
        gte(schema.heartbeatDaily.day, daysAgoIso(29).slice(0, 10)),
      ),
    })
    .from(schema.heartbeatDaily)
    .where(
      and(
        inArray(schema.heartbeatDaily.monitorId, monitorIds),
        gte(
          schema.heartbeatDaily.day,
          daysAgoIso(Math.min(historyDays, 90)).slice(0, 10),
        ),
      ),
    )
    .groupBy(schema.heartbeatDaily.monitorId);

  if (uptime.length === 0) {
    uptime = await db.drizzle
      .select({
        monitorId: schema.heartbeats.monitorId,
        total: count(),
        up: countWhere(eq(schema.heartbeats.status, "up")),
        dayTotal: countWhere(gte(schema.heartbeats.createdAt, daysAgoIso(1))),
        dayUp: countWhere(
          and(
            gte(schema.heartbeats.createdAt, daysAgoIso(1)),
            eq(schema.heartbeats.status, "up"),
          )!,
        ),
        weekTotal: countWhere(gte(schema.heartbeats.createdAt, daysAgoIso(7))),
        weekUp: countWhere(
          and(
            gte(schema.heartbeats.createdAt, daysAgoIso(7)),
            eq(schema.heartbeats.status, "up"),
          )!,
        ),
        monthTotal: countWhere(
          gte(schema.heartbeats.createdAt, daysAgoIso(30)),
        ),
        monthUp: countWhere(
          and(
            gte(schema.heartbeats.createdAt, daysAgoIso(30)),
            eq(schema.heartbeats.status, "up"),
          )!,
        ),
      })
      .from(schema.heartbeats)
      .where(
        and(
          inArray(schema.heartbeats.monitorId, monitorIds),
          gte(
            schema.heartbeats.createdAt,
            daysAgoIso(Math.min(historyDays, 90)),
          ),
        ),
      )
      .groupBy(schema.heartbeats.monitorId);
  }

  const incidents = await db.incident.listForMonitors(monitorIds, 10);

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
