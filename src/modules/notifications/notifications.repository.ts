import "@tanstack/react-start/server-only";
import * as schema from "@schema";
import dayjs from "dayjs";
import { and, asc, db, desc, eq, inArray, isNull, lte, sql } from "void/db";

import {
  type AssignedMonitor,
  NotificationDestination,
  type NotificationInput,
} from "@/lib/schemas/notifications";

/**
 * Persistence for notification destinations, their monitor assignments, and
 * the delivery outbox. Delivery intents are created by the monitors
 * repository's `recordCheck`; this module reads and acknowledges them.
 */

type DestinationRow = typeof schema.notificationDestinations.$inferSelect;

export type DeliveryIntent = typeof schema.notificationDeliveries.$inferSelect;

/** Provider settings are stored as a JSON document next to the provider. */
function toDestination({ configJson, ...row }: DestinationRow) {
  return NotificationDestination.parse({
    ...row,
    config: JSON.parse(configJson),
  });
}

/** The provider settings an input describes, as they are stored. */
function configOf(input: NotificationInput) {
  switch (input.provider) {
    case "discord":
      return { webhookUrl: input.webhookUrl };
    case "webhook":
      return {
        url: input.url,
        headers: input.headers.filter((header) => header.key.length > 0),
      };
    case "telegram":
      return {
        botToken: input.botToken,
        chatId: input.chatId,
        messageThreadId: input.messageThreadId || null,
      };
  }
}

export async function findById(id: string) {
  const [row] = await db
    .select()
    .from(schema.notificationDestinations)
    .where(eq(schema.notificationDestinations.id, id));

  return row ? toDestination(row) : null;
}

export async function list() {
  const rows = await db
    .select()
    .from(schema.notificationDestinations)
    .orderBy(desc(schema.notificationDestinations.createdAt));

  return rows.map(toDestination);
}

/**
 * Assigned monitors per destination id, ordered by monitor name. Pass `null`
 * for every destination.
 */
export async function assignments(
  destinationIds: ReadonlyArray<string> | null,
) {
  const binding = schema.monitorNotificationDestinations;

  const rows = await db
    .select({
      destinationId: binding.notificationDestinationId,
      id: schema.monitors.id,
      name: schema.monitors.name,
      kind: schema.monitors.kind,
    })
    .from(binding)
    .innerJoin(schema.monitors, eq(schema.monitors.id, binding.monitorId))
    .where(
      destinationIds
        ? inArray(binding.notificationDestinationId, [...destinationIds])
        : undefined,
    )
    .orderBy(asc(binding.notificationDestinationId), asc(schema.monitors.name));

  const byDestination = new Map<string, Array<AssignedMonitor>>();

  for (const { destinationId, ...monitor } of rows) {
    const assigned = byDestination.get(destinationId) ?? [];
    assigned.push(monitor);
    byDestination.set(destinationId, assigned);
  }

  return byDestination;
}

export async function listAssignableMonitors(): Promise<
  Array<AssignedMonitor>
> {
  return db
    .select({
      id: schema.monitors.id,
      name: schema.monitors.name,
      kind: schema.monitors.kind,
    })
    .from(schema.monitors)
    .orderBy(asc(schema.monitors.name));
}

export async function listForMonitor(monitorId: string) {
  const binding = schema.monitorNotificationDestinations;

  const rows = await db
    .select({ destination: schema.notificationDestinations })
    .from(binding)
    .innerJoin(
      schema.notificationDestinations,
      eq(schema.notificationDestinations.id, binding.notificationDestinationId),
    )
    .where(eq(binding.monitorId, monitorId))
    .orderBy(asc(schema.notificationDestinations.createdAt));

  return rows.map((row) => toDestination(row.destination));
}

/** Monitor ids from `ids` that don't exist. */
export async function missingMonitorIds(ids: ReadonlyArray<string>) {
  if (ids.length === 0) return [];

  const rows = await db
    .select({ id: schema.monitors.id })
    .from(schema.monitors)
    .where(inArray(schema.monitors.id, [...ids]));

  const existing = new Set(rows.map((row) => row.id));

  return ids.filter((id) => !existing.has(id));
}

// One insert per binding keeps every statement below D1's parameter limit.
function bindingWrites(
  destinationId: string,
  monitorIds: ReadonlyArray<string>,
) {
  return [
    db
      .delete(schema.monitorNotificationDestinations)
      .where(
        eq(
          schema.monitorNotificationDestinations.notificationDestinationId,
          destinationId,
        ),
      ),
    ...[...new Set(monitorIds)].map((monitorId) =>
      db
        .insert(schema.monitorNotificationDestinations)
        .values({ monitorId, notificationDestinationId: destinationId }),
    ),
  ];
}

/** Inserts or replaces a destination and its monitor assignments. */
export async function save(input: NotificationInput, existingId?: string) {
  const id = existingId ?? crypto.randomUUID();
  const now = dayjs().toISOString();

  const values = {
    name: input.name,
    provider: input.provider,
    configJson: JSON.stringify(configOf(input)),
    updatedAt: now,
  };

  await db.batch([
    existingId
      ? db
          .update(schema.notificationDestinations)
          .set(values)
          .where(eq(schema.notificationDestinations.id, id))
      : db
          .insert(schema.notificationDestinations)
          .values({ ...values, id, createdAt: now }),
    ...bindingWrites(id, input.monitorIds),
  ]);

  return id;
}

export async function remove(id: string) {
  await db
    .delete(schema.notificationDestinations)
    .where(eq(schema.notificationDestinations.id, id));
}

export async function listDueIntents(now: number, limit: number) {
  return db
    .select()
    .from(schema.notificationDeliveries)
    .where(
      and(
        isNull(schema.notificationDeliveries.deliveredAt),
        lte(schema.notificationDeliveries.dueAt, now),
      ),
    )
    .orderBy(
      asc(schema.notificationDeliveries.dueAt),
      asc(schema.notificationDeliveries.id),
    )
    .limit(limit);
}

/**
 * Acknowledges a delivered intent. For a down alert, the monitor may have
 * recovered while it was in flight; the recovery intent commits with the
 * acknowledgement so it is never lost.
 */
export async function markDelivered(intent: DeliveryIntent, now: number) {
  const mark = db
    .update(schema.notificationDeliveries)
    .set({ deliveredAt: dayjs().toISOString() })
    .where(eq(schema.notificationDeliveries.id, intent.id));

  if (intent.status !== "down") {
    await mark;

    return;
  }

  const recovery = db
    .insert(schema.notificationDeliveries)
    .select(
      db
        .select({
          id: sql<string>`${`${intent.incidentId}:${intent.destinationId}:up`}`.as(
            "id",
          ),
          incidentId: schema.incidents.id,
          destinationId: sql<string>`${intent.destinationId}`.as(
            "destinationId",
          ),
          monitorId: schema.incidents.monitorId,
          status: sql<"up">`'up'`.as("status"),
          checkedAt: sql<string>`${schema.incidents.closedAt}`.as("checkedAt"),
          error: sql<null>`null`.as("error"),
          dueAt: sql<number>`${now}`.as("dueAt"),
          attempts: sql<number>`0`.as("attempts"),
          deliveredAt: sql<null>`null`.as("deliveredAt"),
        })
        .from(schema.incidents)
        .where(
          and(
            eq(schema.incidents.id, intent.incidentId),
            eq(schema.incidents.status, "closed"),
          ),
        ),
    )
    .onConflictDoNothing();

  await db.batch([mark, recovery]);
}

export async function reschedule(
  intent: DeliveryIntent,
  attempts: number,
  dueAt: number,
) {
  await db
    .update(schema.notificationDeliveries)
    .set({ attempts, dueAt })
    .where(eq(schema.notificationDeliveries.id, intent.id));
}
