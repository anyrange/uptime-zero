import "@tanstack/react-start/server-only";
import * as schema from "@schema";
import dayjs from "dayjs";
import {
  and,
  asc,
  count,
  db,
  desc,
  eq,
  exists,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  notExists,
  sql,
  sum,
} from "void/db";
import { logger } from "void/log";
import { z } from "zod";

import type { MonitorConfig } from "@/lib/schemas/monitor-config";
import type { CheckResult } from "@/modules/monitors/probe";

import {
  type Heartbeat,
  type Monitor,
  MonitorAssertion,
  type MonitorStatus,
} from "@/lib/schemas/monitors";

/**
 * Persistence for the monitor aggregate: monitors, their heartbeats and
 * daily rollups, and the atomic write that records a check result.
 */

type MonitorRow = typeof schema.monitors.$inferSelect;

const StoredAssertions = z.array(MonitorAssertion);

/** Parses the JSON assertions column; a malformed one throws. */
function toMonitor({ assertionsJson, ...row }: MonitorRow): Monitor {
  return {
    ...row,
    assertions: StoredAssertions.parse(JSON.parse(assertionsJson ?? "[]")),
  };
}

type MetricCutoffs = {
  readonly last7Days: string;
  readonly last30Days: string;
  readonly last365Days: string;
};

export async function findById(id: string) {
  const row = await db
    .select()
    .from(schema.monitors)
    .where(eq(schema.monitors.id, id))
    .get();

  return row ? toMonitor(row) : null;
}

export async function findByPushToken(token: string) {
  const row = await db
    .select()
    .from(schema.monitors)
    .where(eq(schema.monitors.pushToken, token))
    .get();

  return row ? toMonitor(row) : null;
}

export async function list() {
  const rows = await db
    .select()
    .from(schema.monitors)
    .orderBy(asc(schema.monitors.name));

  return rows.map(toMonitor);
}

/** Active monitors; a row that fails to parse is logged and skipped. */
export async function listActive() {
  const rows = await db
    .select()
    .from(schema.monitors)
    .where(eq(schema.monitors.active, true))
    .orderBy(asc(schema.monitors.createdAt));

  return rows.flatMap((row) => {
    try {
      return [toMonitor(row)];
    } catch (error) {
      logger.error("invalid monitor row", {
        monitorId: row.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return [];
    }
  });
}

function bindingWrites(
  monitorId: string,
  destinationIds: ReadonlyArray<string>,
) {
  const ids = [...new Set(destinationIds)];

  const clear = db
    .delete(schema.monitorNotificationDestinations)
    .where(eq(schema.monitorNotificationDestinations.monitorId, monitorId));

  return ids.length > 0
    ? [
        clear,
        db.insert(schema.monitorNotificationDestinations).values(
          ids.map((notificationDestinationId) => ({
            monitorId,
            notificationDestinationId,
          })),
        ),
      ]
    : [clear];
}

export async function insert(config: MonitorConfig) {
  const id = crypto.randomUUID();
  const now = dayjs().toISOString();
  const { assertions, notificationDestinationIds, ...values } = config;

  await db.batch([
    db.insert(schema.monitors).values({
      ...values,
      id,
      assertionsJson: JSON.stringify(assertions),
      pushToken: config.kind === "push" ? crypto.randomUUID() : null,
      createdAt: now,
      updatedAt: now,
    }),
    ...bindingWrites(id, notificationDestinationIds),
  ]);

  return findById(id);
}

/** Replaces the configuration; returns null when the monitor is gone. */
export async function update(existing: Monitor, config: MonitorConfig) {
  const { assertions, notificationDestinationIds, ...values } = config;

  await db.batch([
    db
      .update(schema.monitors)
      .set({
        ...values,
        assertionsJson: JSON.stringify(assertions),
        // Push monitors keep their token so existing jobs keep working.
        pushToken:
          config.kind === "push"
            ? (existing.pushToken ?? crypto.randomUUID())
            : null,
        retryAt: null,
        revision: sql`${schema.monitors.revision} + 1`,
        updatedAt: dayjs().toISOString(),
      })
      .where(eq(schema.monitors.id, existing.id)),
    ...bindingWrites(existing.id, notificationDestinationIds),
  ]);

  return findById(existing.id);
}

export async function setActive(id: string, active: boolean) {
  const [row] = await db
    .update(schema.monitors)
    .set({
      active,
      retryAt: null,
      revision: sql`${schema.monitors.revision} + 1`,
      updatedAt: dayjs().toISOString(),
    })
    .where(eq(schema.monitors.id, id))
    .returning();

  return row ? toMonitor(row) : null;
}

export async function rotatePushToken(id: string) {
  const [row] = await db
    .update(schema.monitors)
    .set({
      pushToken: crypto.randomUUID(),
      updatedAt: dayjs().toISOString(),
      revision: sql`${schema.monitors.revision} + 1`,
    })
    .where(and(eq(schema.monitors.id, id), eq(schema.monitors.kind, "push")))
    .returning();

  return row ? toMonitor(row) : null;
}

export async function setRetryAt(id: string, retryAt: number) {
  await db
    .update(schema.monitors)
    .set({ retryAt })
    .where(eq(schema.monitors.id, id));
}

export async function remove(ids: ReadonlyArray<string>) {
  if (ids.length === 0) return;

  await db.delete(schema.monitors).where(inArray(schema.monitors.id, [...ids]));
}

/**
 * Records one check as a single D1 batch: heartbeat, monitor state, daily
 * rollup, incident transition and notification intents commit together.
 * Every statement is gated on the heartbeat insert, which only happens when
 * the monitor is still active at the revision the check ran against, so
 * edits, pauses and deletions during a check discard its result.
 */
export async function recordCheck(
  monitor: Monitor,
  result: CheckResult,
  source: Heartbeat["source"],
  checkedAt: string,
) {
  const heartbeatId = crypto.randomUUID();

  const open = await db
    .select()
    .from(schema.incidents)
    .where(
      and(
        eq(schema.incidents.monitorId, monitor.id),
        eq(schema.incidents.status, "open"),
      ),
    )
    .get();

  const incidentId = open?.id ?? crypto.randomUUID();

  const accepted = exists(
    db
      .select({ id: schema.heartbeats.id })
      .from(schema.heartbeats)
      .where(eq(schema.heartbeats.id, heartbeatId)),
  );

  const heartbeat = db.insert(schema.heartbeats).select(
    db
      .select({
        id: sql<string>`${heartbeatId}`.as("id"),
        monitorId: schema.monitors.id,
        status: sql<MonitorStatus>`${result.status}`.as("status"),
        statusCode: sql<number | null>`${result.statusCode}`.as("statusCode"),
        durationMs: sql<number>`${result.durationMs}`.as("durationMs"),
        error: sql<string | null>`${result.error}`.as("error"),
        createdAt: sql<string>`${checkedAt}`.as("createdAt"),
        source: sql<Heartbeat["source"]>`${source}`.as("source"),
      })
      .from(schema.monitors)
      .where(
        and(
          eq(schema.monitors.id, monitor.id),
          eq(schema.monitors.active, true),
          eq(schema.monitors.revision, monitor.revision),
        ),
      ),
  );

  const state = db
    .update(schema.monitors)
    .set({
      lastStatus: result.status,
      lastCheckedAt: checkedAt,
      lastDurationMs: result.durationMs,
      lastError: result.error,
      updatedAt: checkedAt,
      retryAt: null,
      revision: sql`${schema.monitors.revision} + 1`,
    })
    .where(and(eq(schema.monitors.id, monitor.id), accepted));

  const statusCount = (status: MonitorStatus) =>
    result.status === status ? 1 : 0;

  const daily = db
    .insert(schema.heartbeatDaily)
    .select(
      db
        .select({
          monitorId: schema.monitors.id,
          day: sql<string>`${checkedAt.slice(0, 10)}`.as("day"),
          total: sql<number>`1`.as("total"),
          up: sql<number>`${statusCount("up")}`.as("up"),
          down: sql<number>`${statusCount("down")}`.as("down"),
          unknown: sql<number>`${statusCount("unknown")}`.as("unknown"),
        })
        .from(schema.monitors)
        .where(and(eq(schema.monitors.id, monitor.id), accepted)),
    )
    .onConflictDoUpdate({
      target: [schema.heartbeatDaily.monitorId, schema.heartbeatDaily.day],
      set: {
        total: sql`${schema.heartbeatDaily.total} + 1`,
        up: sql`${schema.heartbeatDaily.up} + ${statusCount("up")}`,
        down: sql`${schema.heartbeatDaily.down} + ${statusCount("down")}`,
        unknown: sql`${schema.heartbeatDaily.unknown} + ${statusCount("unknown")}`,
      },
    });

  const deliveries = schema.notificationDeliveries;

  if (result.status === "down") {
    const incident = db.insert(schema.incidents).select(
      db
        .select({
          id: sql<string>`${incidentId}`.as("id"),
          monitorId: schema.monitors.id,
          title: sql<string>`${monitor.name + " is down"}`.as("title"),
          status: sql<"open">`'open'`.as("status"),
          body: sql<string | null>`${result.error}`.as("body"),
          pinned: sql<boolean>`0`.as("pinned"),
          openedAt: sql<string>`${checkedAt}`.as("openedAt"),
          closedAt: sql<null>`null`.as("closedAt"),
        })
        .from(schema.monitors)
        .where(
          and(
            eq(schema.monitors.id, monitor.id),
            accepted,
            notExists(
              db
                .select({ id: schema.incidents.id })
                .from(schema.incidents)
                .where(eq(schema.incidents.id, incidentId)),
            ),
          ),
        ),
    );

    // Down alerts wait out the monitor's grace period from when the
    // incident opened, so a quick recovery can cancel them untried.
    const openedAt = open?.openedAt ?? checkedAt;
    const binding = schema.monitorNotificationDestinations;

    const downIntents = db
      .insert(deliveries)
      .select(
        db
          .select({
            id: sql<string>`${incidentId} || ':' || ${binding.notificationDestinationId} || ':down'`.as(
              "id",
            ),
            incidentId: sql<string>`${incidentId}`.as("incidentId"),
            destinationId: binding.notificationDestinationId,
            monitorId: binding.monitorId,
            status: sql<"down">`'down'`.as("status"),
            checkedAt: sql<string>`${openedAt}`.as("checkedAt"),
            error: sql<string | null>`${result.error}`.as("error"),
            dueAt:
              sql<number>`${Date.parse(openedAt) + monitor.notificationGraceSec * 1000}`.as(
                "dueAt",
              ),
            attempts: sql<number>`0`.as("attempts"),
            deliveredAt: sql<null>`null`.as("deliveredAt"),
          })
          .from(binding)
          .where(and(eq(binding.monitorId, monitor.id), accepted)),
      )
      .onConflictDoNothing();

    await db.batch([heartbeat, state, daily, incident, downIntents]);

    return;
  }

  if (result.status === "up" && open) {
    // Recovery goes only to destinations that actually received the down
    // alert.
    const recoveryIntents = db
      .insert(deliveries)
      .select(
        db
          .select({
            id: sql<string>`${incidentId} || ':' || ${deliveries.destinationId} || ':up'`.as(
              "id",
            ),
            incidentId: deliveries.incidentId,
            destinationId: deliveries.destinationId,
            monitorId: deliveries.monitorId,
            status: sql<"up">`'up'`.as("status"),
            checkedAt: sql<string>`${checkedAt}`.as("checkedAt"),
            error: sql<null>`null`.as("error"),
            dueAt: sql<number>`${Date.parse(checkedAt)}`.as("dueAt"),
            attempts: sql<number>`0`.as("attempts"),
            deliveredAt: sql<null>`null`.as("deliveredAt"),
          })
          .from(deliveries)
          .where(
            and(
              eq(deliveries.incidentId, incidentId),
              eq(deliveries.status, "down"),
              isNotNull(deliveries.deliveredAt),
              accepted,
            ),
          ),
      )
      .onConflictDoNothing();

    const cancelPendingDown = db
      .delete(deliveries)
      .where(
        and(
          eq(deliveries.incidentId, incidentId),
          eq(deliveries.status, "down"),
          isNull(deliveries.deliveredAt),
          gt(deliveries.dueAt, Date.parse(checkedAt)),
          eq(deliveries.attempts, 0),
          accepted,
        ),
      );

    const close = db
      .update(schema.incidents)
      .set({ status: "closed", closedAt: checkedAt })
      .where(and(eq(schema.incidents.id, incidentId), accepted));

    await db.batch([
      heartbeat,
      state,
      daily,
      recoveryIntents,
      cancelPendingDown,
      close,
    ]);

    return;
  }

  await db.batch([heartbeat, state, daily]);
}

export async function listHeartbeats(
  monitorId: string,
  options: { readonly limit: number; readonly since?: string },
) {
  const rows = await db
    .select()
    .from(schema.heartbeats)
    .where(
      and(
        eq(schema.heartbeats.monitorId, monitorId),
        options.since
          ? gte(schema.heartbeats.createdAt, options.since)
          : undefined,
      ),
    )
    .orderBy(desc(schema.heartbeats.createdAt))
    .limit(options.limit);

  return rows;
}

export async function listHeartbeatPage(
  monitorId: string,
  limit: number,
  offset: number,
) {
  const rows = await db
    .select()
    .from(schema.heartbeats)
    .where(eq(schema.heartbeats.monitorId, monitorId))
    .orderBy(desc(schema.heartbeats.createdAt))
    .limit(limit)
    .offset(offset);

  return rows;
}

export async function listRecentHeartbeats(limit: number) {
  const rows = await db
    .select()
    .from(schema.heartbeats)
    .orderBy(desc(schema.heartbeats.createdAt))
    .limit(limit);

  return rows;
}

export async function listSuccessfulDurations(limit: number) {
  return await db
    .select({
      monitorId: schema.heartbeats.monitorId,
      durationMs: schema.heartbeats.durationMs,
    })
    .from(schema.heartbeats)
    .where(eq(schema.heartbeats.status, "up"))
    .orderBy(desc(schema.heartbeats.createdAt))
    .limit(limit);
}

export async function countHeartbeats(monitorId: string) {
  const rollup = await db
    .select({ count: sum(schema.heartbeatDaily.total).mapWith(Number) })
    .from(schema.heartbeatDaily)
    .where(eq(schema.heartbeatDaily.monitorId, monitorId))
    .get();

  if (rollup?.count != null) return rollup.count;

  const raw = await db
    .select({ count: count() })
    .from(schema.heartbeats)
    .where(eq(schema.heartbeats.monitorId, monitorId))
    .get();

  return raw?.count ?? 0;
}

export async function countRecentHeartbeats(cutoffs: {
  readonly hour: string;
  readonly day: string;
}) {
  const [hour, day] = await Promise.all([
    db
      .select({ count: count() })
      .from(schema.heartbeats)
      .where(gte(schema.heartbeats.createdAt, cutoffs.hour))
      .get(),
    db
      .select({ count: sum(schema.heartbeatDaily.total).mapWith(Number) })
      .from(schema.heartbeatDaily)
      .where(gte(schema.heartbeatDaily.day, cutoffs.day.slice(0, 10)))
      .get(),
  ]);

  // Rollups are missing for history recorded before they existed.
  const lastDay =
    day?.count ??
    (
      await db
        .select({ count: count() })
        .from(schema.heartbeats)
        .where(gte(schema.heartbeats.createdAt, cutoffs.day))
        .get()
    )?.count ??
    0;

  return { lastHour: hour?.count ?? 0, lastDay };
}

export async function availabilityCounts(
  monitorId: string,
  cutoffs: MetricCutoffs,
) {
  const day = (iso: string) => iso.slice(0, 10);

  const rollup = await db
    .select({
      requestCount: sum(schema.heartbeatDaily.total).mapWith(Number),
      last7DaysTotal:
        sql<number>`sum(case when ${gte(schema.heartbeatDaily.day, day(cutoffs.last7Days))} then ${schema.heartbeatDaily.total} else 0 end)`.mapWith(
          Number,
        ),
      last7DaysUp:
        sql<number>`sum(case when ${gte(schema.heartbeatDaily.day, day(cutoffs.last7Days))} then ${schema.heartbeatDaily.up} else 0 end)`.mapWith(
          Number,
        ),
      last30DaysTotal:
        sql<number>`sum(case when ${gte(schema.heartbeatDaily.day, day(cutoffs.last30Days))} then ${schema.heartbeatDaily.total} else 0 end)`.mapWith(
          Number,
        ),
      last30DaysUp:
        sql<number>`sum(case when ${gte(schema.heartbeatDaily.day, day(cutoffs.last30Days))} then ${schema.heartbeatDaily.up} else 0 end)`.mapWith(
          Number,
        ),
      last365DaysTotal: sum(schema.heartbeatDaily.total).mapWith(Number),
      last365DaysUp: sum(schema.heartbeatDaily.up).mapWith(Number),
    })
    .from(schema.heartbeatDaily)
    .where(
      and(
        eq(schema.heartbeatDaily.monitorId, monitorId),
        gte(schema.heartbeatDaily.day, day(cutoffs.last365Days)),
      ),
    )
    .get();

  if (rollup?.requestCount != null) return toAvailabilityCounts(rollup);

  // Rollups are missing for history recorded before they existed.
  const isUp = eq(schema.heartbeats.status, "up");

  const raw = await db
    .select({
      requestCount: count(),
      last7DaysTotal:
        sql<number>`sum(case when ${gte(schema.heartbeats.createdAt, cutoffs.last7Days)} then 1 else 0 end)`.mapWith(
          Number,
        ),
      last7DaysUp:
        sql<number>`sum(case when ${and(gte(schema.heartbeats.createdAt, cutoffs.last7Days), isUp)!} then 1 else 0 end)`.mapWith(
          Number,
        ),
      last30DaysTotal:
        sql<number>`sum(case when ${gte(schema.heartbeats.createdAt, cutoffs.last30Days)} then 1 else 0 end)`.mapWith(
          Number,
        ),
      last30DaysUp:
        sql<number>`sum(case when ${and(gte(schema.heartbeats.createdAt, cutoffs.last30Days), isUp)!} then 1 else 0 end)`.mapWith(
          Number,
        ),
      last365DaysTotal: count(),
      last365DaysUp:
        sql<number>`sum(case when ${isUp} then 1 else 0 end)`.mapWith(Number),
    })
    .from(schema.heartbeats)
    .where(
      and(
        eq(schema.heartbeats.monitorId, monitorId),
        gte(schema.heartbeats.createdAt, cutoffs.last365Days),
      ),
    )
    .get();

  return toAvailabilityCounts(raw);
}

function toAvailabilityCounts(
  row:
    | {
        requestCount: number | null;
        last7DaysTotal: number | null;
        last7DaysUp: number | null;
        last30DaysTotal: number | null;
        last30DaysUp: number | null;
        last365DaysTotal: number | null;
        last365DaysUp: number | null;
      }
    | undefined,
) {
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
