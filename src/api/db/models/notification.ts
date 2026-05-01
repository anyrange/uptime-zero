import { asc, desc, eq, inArray } from "drizzle-orm";

import type {
  NotificationDestinationConfig,
  NotificationDestinationMonitorSummary,
  NotificationProvider,
} from "@/types";

import { schema, type AppDrizzleDb } from "@/api/db";
import {
  mapNotificationDestinationDetail,
  mapNotificationDestinationListItem,
  mapNotificationDestinationRecord,
  normalizeMonitorKind,
} from "@/api/db/normalize";
import { nowIso } from "@/api/lib/dates";
import {
  dispatchNotificationEvent,
  serializeNotificationConfig,
} from "@/api/lib/notifications";

export class NotificationDestinationValidationError extends Error {}

export class NotificationModel {
  constructor(private readonly db: AppDrizzleDb) {}

  async create(
    name: string,
    provider: NotificationProvider,
    config: NotificationDestinationConfig,
    monitorIds: string[] = [],
  ) {
    const now = nowIso();
    const id = crypto.randomUUID();
    const dedupedMonitorIds = dedupeIds(monitorIds);
    await this.validateMonitorIds(dedupedMonitorIds);
    await this.db.insert(schema.notificationDestinations).values({
      id,
      name,
      provider,
      configJson: serializeNotificationConfig(provider, config),
      createdAt: now,
      updatedAt: now,
    });
    await this.replaceDestinationMonitorBindings(id, dedupedMonitorIds);
    return this.getDetail(id);
  }

  async list() {
    const destinations = await this.db
      .select()
      .from(schema.notificationDestinations)
      .orderBy(desc(schema.notificationDestinations.createdAt));
    const assignments = await this.listAssignments();
    return destinations.map((destination) =>
      mapNotificationDestinationListItem(destination, assignments),
    );
  }

  async getById(id: string) {
    const destination = await this.db
      .select()
      .from(schema.notificationDestinations)
      .where(eq(schema.notificationDestinations.id, id))
      .get();
    return destination ? mapNotificationDestinationRecord(destination) : null;
  }

  async getDetail(id: string) {
    const destination = await this.db
      .select()
      .from(schema.notificationDestinations)
      .where(eq(schema.notificationDestinations.id, id))
      .get();
    if (!destination) {
      return null;
    }

    const assignments = await this.listAssignments([id]);
    return mapNotificationDestinationDetail(destination, assignments);
  }

  async update(
    id: string,
    payload: {
      name: string;
      provider: NotificationProvider;
      config: NotificationDestinationConfig;
      monitorIds: string[];
    },
  ) {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const dedupedMonitorIds = dedupeIds(payload.monitorIds);
    await this.validateMonitorIds(dedupedMonitorIds);

    await this.db
      .update(schema.notificationDestinations)
      .set({
        name: payload.name,
        provider: payload.provider,
        configJson: serializeNotificationConfig(
          payload.provider,
          payload.config,
        ),
        updatedAt: nowIso(),
      })
      .where(eq(schema.notificationDestinations.id, id));

    await this.replaceDestinationMonitorBindings(id, dedupedMonitorIds);

    return this.getDetail(id);
  }

  delete(id: string) {
    return this.db
      .delete(schema.notificationDestinations)
      .where(eq(schema.notificationDestinations.id, id));
  }

  async getMonitorDestinationIds(monitorId: string) {
    const bindings = await this.db
      .select({
        notificationDestinationId:
          schema.monitorNotificationDestinations.notificationDestinationId,
      })
      .from(schema.monitorNotificationDestinations)
      .where(eq(schema.monitorNotificationDestinations.monitorId, monitorId))
      .orderBy(
        asc(schema.monitorNotificationDestinations.notificationDestinationId),
      );
    return bindings.map((binding) => binding.notificationDestinationId);
  }

  async replaceMonitorBindings(
    monitorId: string,
    notificationDestinationIds: string[],
  ) {
    const dedupedIds = dedupeIds(notificationDestinationIds);
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

  async listAssignableMonitors() {
    const monitors = await this.db
      .select({
        id: schema.monitors.id,
        name: schema.monitors.name,
        kind: schema.monitors.kind,
      })
      .from(schema.monitors)
      .orderBy(asc(schema.monitors.name));

    return monitors.map((monitor) => ({
      id: monitor.id,
      name: monitor.name,
      kind: normalizeMonitorKind(monitor.kind),
    })) satisfies NotificationDestinationMonitorSummary[];
  }

  async getForMonitor(monitorId: string) {
    const rows = await this.db
      .select({
        id: schema.notificationDestinations.id,
        name: schema.notificationDestinations.name,
        provider: schema.notificationDestinations.provider,
        configJson: schema.notificationDestinations.configJson,
        createdAt: schema.notificationDestinations.createdAt,
        updatedAt: schema.notificationDestinations.updatedAt,
      })
      .from(schema.monitorNotificationDestinations)
      .innerJoin(
        schema.notificationDestinations,
        eq(
          schema.notificationDestinations.id,
          schema.monitorNotificationDestinations.notificationDestinationId,
        ),
      )
      .where(eq(schema.monitorNotificationDestinations.monitorId, monitorId))
      .orderBy(asc(schema.notificationDestinations.createdAt));

    return rows.map(mapNotificationDestinationRecord);
  }

  async test(destinationId: string, fetchImpl: typeof fetch = fetch) {
    const destination = await this.getById(destinationId);
    if (!destination) {
      return;
    }

    await dispatchNotificationEvent(
      [destination],
      {
        kind: "test",
        sentAt: nowIso(),
        destination: {
          id: destination.id,
          name: destination.name,
          provider: destination.provider,
        },
      },
      fetchImpl,
    );
  }

  private async listAssignments(destinationIds?: string[]) {
    const rows = await this.db
      .select({
        destinationId:
          schema.monitorNotificationDestinations.notificationDestinationId,
        monitorId: schema.monitors.id,
        monitorName: schema.monitors.name,
        monitorKind: schema.monitors.kind,
      })
      .from(schema.monitorNotificationDestinations)
      .innerJoin(
        schema.monitors,
        eq(
          schema.monitors.id,
          schema.monitorNotificationDestinations.monitorId,
        ),
      )
      .where(
        destinationIds && destinationIds.length > 0
          ? inArray(
              schema.monitorNotificationDestinations.notificationDestinationId,
              destinationIds,
            )
          : undefined,
      )
      .orderBy(
        asc(schema.monitorNotificationDestinations.notificationDestinationId),
        asc(schema.monitors.name),
      );

    const assignments = new Map<
      string,
      NotificationDestinationMonitorSummary[]
    >();
    for (const row of rows) {
      const current = assignments.get(row.destinationId) ?? [];
      current.push({
        id: row.monitorId,
        name: row.monitorName,
        kind: normalizeMonitorKind(row.monitorKind),
      });
      assignments.set(row.destinationId, current);
    }

    return assignments;
  }

  private async validateMonitorIds(monitorIds: string[]) {
    if (monitorIds.length === 0) {
      return;
    }

    const rows = await this.db
      .select({ id: schema.monitors.id })
      .from(schema.monitors)
      .where(inArray(schema.monitors.id, monitorIds));
    const existingIds = new Set(rows.map((row) => row.id));
    const missingIds = monitorIds.filter((id) => !existingIds.has(id));

    if (missingIds.length > 0) {
      throw new NotificationDestinationValidationError(
        `Unknown monitor ids: ${missingIds.join(", ")}`,
      );
    }
  }

  private async replaceDestinationMonitorBindings(
    destinationId: string,
    monitorIds: string[],
  ) {
    const dedupedIds = dedupeIds(monitorIds);
    await this.db
      .delete(schema.monitorNotificationDestinations)
      .where(
        eq(
          schema.monitorNotificationDestinations.notificationDestinationId,
          destinationId,
        ),
      );

    if (dedupedIds.length === 0) {
      return;
    }

    await this.db.insert(schema.monitorNotificationDestinations).values(
      dedupedIds.map((monitorId) => ({
        monitorId,
        notificationDestinationId: destinationId,
      })),
    );
  }
}

function dedupeIds(ids: string[]) {
  return [...new Set(ids)];
}
