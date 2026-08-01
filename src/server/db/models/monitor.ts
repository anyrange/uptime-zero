import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import type {
  HeartbeatRecord,
  MonitorCheckResult,
  MonitorRecord,
  MonitorStatus,
} from "@/types";

import { parseMonitorAssertions } from "@/lib/monitor/assertions";
import { schema, type DrizzleDatabase } from "@/server/db";
import {
  readHeartbeatMode,
  readHeartbeatSource,
  readMonitorKind,
  readMonitorStatus,
} from "@/server/db/values";
import { nowIso } from "@/server/lib/dates";

type MonitorRow = typeof schema.monitors.$inferSelect;
type HeartbeatRow = typeof schema.heartbeats.$inferSelect;

export class MonitorModel {
  constructor(private readonly db: DrizzleDatabase) {}

  async createOrUpdate(
    payload: Partial<MonitorRecord> & {
      id?: string;
      notificationDestinationIds?: string[];
    },
  ) {
    const now = nowIso();
    const id = payload.id ?? crypto.randomUUID();
    const existing = payload.id
      ? await this.db
          .select()
          .from(schema.monitors)
          .where(eq(schema.monitors.id, payload.id))
          .get()
      : null;
    const kind = readMonitorKind(payload.kind ?? existing?.kind ?? "http");
    const assertions = parseMonitorAssertions(
      payload.assertions ?? existing?.assertionsJson ?? null,
    );
    const pushToken =
      kind === "push"
        ? (existing?.pushToken ?? payload.pushToken ?? crypto.randomUUID())
        : null;

    if (existing) {
      await this.db
        .update(schema.monitors)
        .set({
          name: payload.name ?? existing.name,
          kind,
          target: payload.target ?? existing.target,
          intervalSec: payload.intervalSec ?? existing.intervalSec,
          timeoutMs: payload.timeoutMs ?? existing.timeoutMs,
          retries: payload.retries ?? existing.retries,
          assertionsJson: JSON.stringify(assertions),
          heartbeatMode:
            kind === "push"
              ? (payload.heartbeatMode ?? existing.heartbeatMode)
              : "interval",
          heartbeatCron:
            kind === "push"
              ? (payload.heartbeatCron ?? existing.heartbeatCron)
              : null,
          heartbeatGraceSec:
            kind === "push"
              ? (payload.heartbeatGraceSec ?? existing.heartbeatGraceSec)
              : null,
          heartbeatTimezone:
            kind === "push"
              ? (payload.heartbeatTimezone ?? existing.heartbeatTimezone)
              : null,
          notificationGraceSec:
            payload.notificationGraceSec ?? existing.notificationGraceSec,
          pushToken,
          active: payload.active ?? existing.active,
          updatedAt: now,
        })
        .where(eq(schema.monitors.id, id));
    } else {
      await this.db.insert(schema.monitors).values({
        id,
        name: payload.name ?? "New monitor",
        kind,
        target: payload.target ?? "",
        intervalSec: payload.intervalSec ?? 60,
        timeoutMs: payload.timeoutMs ?? 10_000,
        retries: payload.retries ?? 0,
        assertionsJson: JSON.stringify(assertions),
        heartbeatMode:
          kind === "push" ? (payload.heartbeatMode ?? "interval") : "interval",
        heartbeatCron: kind === "push" ? (payload.heartbeatCron ?? null) : null,
        heartbeatGraceSec:
          kind === "push" ? (payload.heartbeatGraceSec ?? null) : null,
        heartbeatTimezone:
          kind === "push" ? (payload.heartbeatTimezone ?? null) : null,
        notificationGraceSec: payload.notificationGraceSec ?? 0,
        pushToken,
        active: payload.active ?? 1,
        lastStatus: "unknown",
        lastCheckedAt: null,
        lastDurationMs: null,
        lastError: null,
        lastDownNotifiedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (payload.notificationDestinationIds) {
      await this.replaceNotificationDestinationBindings(
        id,
        payload.notificationDestinationIds,
      );
    }

    const monitor = await this.db
      .select()
      .from(schema.monitors)
      .where(eq(schema.monitors.id, id))
      .get();
    return monitor ? mapMonitorRecord(monitor) : null;
  }

  async getById(id: string) {
    const monitor = await this.db
      .select()
      .from(schema.monitors)
      .where(eq(schema.monitors.id, id))
      .get();
    return monitor ? mapMonitorRecord(monitor) : null;
  }

  async listActiveIds() {
    const rows = await this.db
      .select({ id: schema.monitors.id })
      .from(schema.monitors)
      .where(eq(schema.monitors.active, 1))
      .orderBy(asc(schema.monitors.createdAt));
    return rows.map((row) => row.id);
  }

  async listActive() {
    const rows = await this.db
      .select()
      .from(schema.monitors)
      .where(eq(schema.monitors.active, 1))
      .orderBy(asc(schema.monitors.createdAt));
    return rows.map(mapMonitorRecord);
  }

  async listByName() {
    const rows = await this.db
      .select()
      .from(schema.monitors)
      .orderBy(asc(schema.monitors.name));
    return rows.map(mapMonitorRecord);
  }

  listAll() {
    return this.listByName();
  }

  async listByIdsByName(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db
      .select()
      .from(schema.monitors)
      .where(inArray(schema.monitors.id, ids))
      .orderBy(asc(schema.monitors.name));
    return rows.map(mapMonitorRecord);
  }

  async getByPushToken(token: string) {
    const monitor = await this.db
      .select()
      .from(schema.monitors)
      .where(eq(schema.monitors.pushToken, token))
      .get();
    return monitor ? mapMonitorRecord(monitor) : null;
  }

  delete(id: string) {
    return this.db.delete(schema.monitors).where(eq(schema.monitors.id, id));
  }

  deleteAll() {
    return this.db.delete(schema.monitors);
  }

  async exists(id: string) {
    const row = await this.db
      .select({ id: schema.monitors.id })
      .from(schema.monitors)
      .where(eq(schema.monitors.id, id))
      .get();
    return Boolean(row);
  }

  async listSuccessfulDurations(limit: number) {
    return this.db
      .select({
        monitorId: schema.heartbeats.monitorId,
        durationMs: schema.heartbeats.durationMs,
      })
      .from(schema.heartbeats)
      .where(eq(schema.heartbeats.status, "up"))
      .orderBy(desc(schema.heartbeats.createdAt))
      .limit(limit);
  }

  async listHeartbeats(monitorId: string, limit: number) {
    const rows = await this.db
      .select()
      .from(schema.heartbeats)
      .where(eq(schema.heartbeats.monitorId, monitorId))
      .orderBy(desc(schema.heartbeats.createdAt))
      .limit(limit);
    return rows.map(mapHeartbeatRecord);
  }

  async listRecentHeartbeats(limit: number) {
    const rows = await this.db
      .select()
      .from(schema.heartbeats)
      .orderBy(desc(schema.heartbeats.createdAt))
      .limit(limit);
    return rows.map(mapHeartbeatRecord);
  }

  async countHeartbeatsSince(cutoff: string) {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.heartbeats)
      .where(sql`${schema.heartbeats.createdAt} >= ${cutoff}`);
    return rows[0]?.count ?? 0;
  }

  async listHeartbeatsForMonitors(
    monitorIds: string[],
    limitPerMonitor: number,
  ) {
    if (monitorIds.length === 0 || limitPerMonitor <= 0) {
      return [];
    }

    const rankedHeartbeats = this.db.$with("ranked_heartbeats").as(
      this.db
        .select({
          id: schema.heartbeats.id,
          monitorId: schema.heartbeats.monitorId,
          status: schema.heartbeats.status,
          statusCode: schema.heartbeats.statusCode,
          durationMs: schema.heartbeats.durationMs,
          error: schema.heartbeats.error,
          createdAt: schema.heartbeats.createdAt,
          source: schema.heartbeats.source,
          rank: sql<number>`row_number() over (partition by ${schema.heartbeats.monitorId} order by ${schema.heartbeats.createdAt} desc)`.as(
            "rank",
          ),
        })
        .from(schema.heartbeats)
        .where(inArray(schema.heartbeats.monitorId, monitorIds)),
    );

    const rows = await this.db
      .with(rankedHeartbeats)
      .select({
        id: rankedHeartbeats.id,
        monitorId: rankedHeartbeats.monitorId,
        status: rankedHeartbeats.status,
        statusCode: rankedHeartbeats.statusCode,
        durationMs: rankedHeartbeats.durationMs,
        error: rankedHeartbeats.error,
        createdAt: rankedHeartbeats.createdAt,
        source: rankedHeartbeats.source,
      })
      .from(rankedHeartbeats)
      .where(lte(rankedHeartbeats.rank, limitPerMonitor))
      .orderBy(
        asc(rankedHeartbeats.monitorId),
        desc(rankedHeartbeats.createdAt),
      );

    return rows.map(mapHeartbeatRecord);
  }

  async listHeartbeatsForMonitorsSince(monitorIds: string[], cutoff: string) {
    if (monitorIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(schema.heartbeats)
      .where(
        and(
          inArray(schema.heartbeats.monitorId, monitorIds),
          gte(schema.heartbeats.createdAt, cutoff),
        ),
      )
      .orderBy(
        asc(schema.heartbeats.monitorId),
        desc(schema.heartbeats.createdAt),
      );

    return rows.map(mapHeartbeatRecord);
  }

  async countHeartbeats(monitorId: string) {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.heartbeats)
      .where(eq(schema.heartbeats.monitorId, monitorId));
    return count ?? 0;
  }

  async getHeartbeatMetricCounts(
    monitorId: string,
    cutoffs: { last7Days: string; last30Days: string; last365Days: string },
  ) {
    const row = await this.db
      .select({
        requestCount: sql<number>`count(*)`,
        last7DaysTotal: sql<number>`sum(case when ${schema.heartbeats.createdAt} >= ${cutoffs.last7Days} then 1 else 0 end)`,
        last7DaysUp: sql<number>`sum(case when ${schema.heartbeats.createdAt} >= ${cutoffs.last7Days} and ${schema.heartbeats.status} = 'up' then 1 else 0 end)`,
        last30DaysTotal: sql<number>`sum(case when ${schema.heartbeats.createdAt} >= ${cutoffs.last30Days} then 1 else 0 end)`,
        last30DaysUp: sql<number>`sum(case when ${schema.heartbeats.createdAt} >= ${cutoffs.last30Days} and ${schema.heartbeats.status} = 'up' then 1 else 0 end)`,
        last365DaysTotal: sql<number>`sum(case when ${schema.heartbeats.createdAt} >= ${cutoffs.last365Days} then 1 else 0 end)`,
        last365DaysUp: sql<number>`sum(case when ${schema.heartbeats.createdAt} >= ${cutoffs.last365Days} and ${schema.heartbeats.status} = 'up' then 1 else 0 end)`,
      })
      .from(schema.heartbeats)
      .where(eq(schema.heartbeats.monitorId, monitorId))
      .get();

    return {
      requestCount: row?.requestCount ?? 0,
      windows: [
        {
          days: 7,
          totalChecks: row?.last7DaysTotal ?? 0,
          upChecks: row?.last7DaysUp ?? 0,
        },
        {
          days: 30,
          totalChecks: row?.last30DaysTotal ?? 0,
          upChecks: row?.last30DaysUp ?? 0,
        },
        {
          days: 365,
          totalChecks: row?.last365DaysTotal ?? 0,
          upChecks: row?.last365DaysUp ?? 0,
        },
      ],
    };
  }

  async listHeartbeatPage(monitorId: string, limit: number, offset: number) {
    const rows = await this.db
      .select()
      .from(schema.heartbeats)
      .where(eq(schema.heartbeats.monitorId, monitorId))
      .orderBy(desc(schema.heartbeats.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(mapHeartbeatRecord);
  }

  insertHeartbeat(
    monitorId: string,
    result: MonitorCheckResult,
    source: HeartbeatRecord["source"],
    createdAt: string,
  ) {
    return this.db.insert(schema.heartbeats).values({
      id: crypto.randomUUID(),
      monitorId,
      status: result.status,
      statusCode: result.statusCode,
      durationMs: result.durationMs,
      error: result.error,
      createdAt,
      source,
    });
  }

  updateState(
    monitorId: string,
    status: MonitorStatus,
    checkedAt: string,
    durationMs: number,
    error: string | null,
  ) {
    return this.db
      .update(schema.monitors)
      .set({
        lastStatus: status,
        lastCheckedAt: checkedAt,
        lastDurationMs: durationMs,
        lastError: error,
        updatedAt: checkedAt,
      })
      .where(eq(schema.monitors.id, monitorId));
  }

  updateCheckAttempt(
    monitorId: string,
    checkedAt: string,
    durationMs: number,
    error: string | null,
  ) {
    return this.db
      .update(schema.monitors)
      .set({
        lastCheckedAt: checkedAt,
        lastDurationMs: durationMs,
        lastError: error,
        updatedAt: checkedAt,
      })
      .where(eq(schema.monitors.id, monitorId));
  }

  markDownNotificationDelivered(monitorId: string, checkedAt: string) {
    return this.db
      .update(schema.monitors)
      .set({ lastDownNotifiedAt: checkedAt, updatedAt: checkedAt })
      .where(eq(schema.monitors.id, monitorId));
  }

  clearDownNotificationDelivered(monitorId: string, checkedAt: string) {
    return this.db
      .update(schema.monitors)
      .set({ lastDownNotifiedAt: null, updatedAt: checkedAt })
      .where(eq(schema.monitors.id, monitorId));
  }

  private async replaceNotificationDestinationBindings(
    monitorId: string,
    notificationDestinationIds: string[],
  ) {
    const dedupedIds = [...new Set(notificationDestinationIds)];
    await this.db
      .delete(schema.monitorNotificationDestinations)
      .where(eq(schema.monitorNotificationDestinations.monitorId, monitorId));
    if (dedupedIds.length === 0) {
      return;
    }
    await this.db.insert(schema.monitorNotificationDestinations).values(
      dedupedIds.map((notificationDestinationId) => ({
        monitorId,
        notificationDestinationId,
      })),
    );
  }
}

export function mapMonitorRecord(row: MonitorRow) {
  return {
    ...row,
    kind: readMonitorKind(row.kind),
    assertions: parseMonitorAssertions(row.assertionsJson ?? null),
    lastStatus: readMonitorStatus(row.lastStatus),
    heartbeatMode: readHeartbeatMode(row.heartbeatMode),
  } satisfies MonitorRecord;
}

export function mapHeartbeatRecord(row: HeartbeatRow) {
  return {
    ...row,
    status: readMonitorStatus(row.status),
    source: readHeartbeatSource(row.source),
  } satisfies HeartbeatRecord;
}
