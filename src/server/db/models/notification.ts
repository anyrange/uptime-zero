import { asc, desc, eq, inArray } from "drizzle-orm";

import type {
  NotificationDestinationConfig,
  NotificationDestinationDetail,
  NotificationDestinationListItem,
  NotificationDestinationMonitorSummary,
  NotificationDestinationRecord,
  NotificationProvider,
} from "@/types";

import { schema, type DrizzleDatabase } from "@/server/db";
import { readMonitorKind, readNotificationProvider } from "@/server/db/values";
import { nowIso } from "@/server/lib/dates";
import {
  parseNotificationConfig,
  serializeNotificationConfig,
} from "@/server/services/notifications/config";

export class NotificationDestinationValidationError extends Error {}

type NotificationDestinationRow =
  typeof schema.notificationDestinations.$inferSelect;

export type NotificationDestinationRecordRow = Pick<
  NotificationDestinationRow,
  "id" | "name" | "provider" | "configJson" | "createdAt" | "updatedAt"
>;

export class NotificationModel {
  constructor(private readonly db: DrizzleDatabase) {}

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

    const save = this.db.insert(schema.notificationDestinations).values({
      id,
      name,
      provider,
      configJson: serializeNotificationConfig(provider, config),
      createdAt: now,
      updatedAt: now,
    });

    await this.db.batch([
      save,
      ...this.destinationBindingWrites(id, dedupedMonitorIds),
    ]);

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

  async listRecords() {
    const destinations = await this.db
      .select()
      .from(schema.notificationDestinations)
      .orderBy(desc(schema.notificationDestinations.createdAt));

    return destinations.map(mapNotificationDestinationRecord);
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

    const save = this.db
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

    await this.db.batch([
      save,
      ...this.destinationBindingWrites(id, dedupedMonitorIds),
    ]);

    return this.getDetail(id);
  }

  delete(id: string) {
    return this.db
      .delete(schema.notificationDestinations)
      .where(eq(schema.notificationDestinations.id, id));
  }

  deleteAll() {
    return this.db.delete(schema.notificationDestinations);
  }

  deleteAllBindings() {
    return this.db.delete(schema.monitorNotificationDestinations);
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
      kind: readMonitorKind(monitor.kind),
    })) satisfies NotificationDestinationMonitorSummary[];
  }

  async getForMonitor(monitorId: string) {
    const monitor = await this.db.query.monitors.findFirst({
      where: { id: monitorId },
      columns: { id: true },
      with: {
        notificationDestinations: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return (monitor?.notificationDestinations ?? []).map(
      mapNotificationDestinationRecord,
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
        kind: readMonitorKind(row.monitorKind),
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

  private destinationBindingWrites(
    destinationId: string,
    monitorIds: string[],
  ) {
    const clear = this.db
      .delete(schema.monitorNotificationDestinations)
      .where(
        eq(
          schema.monitorNotificationDestinations.notificationDestinationId,
          destinationId,
        ),
      );

    return [
      clear,
      ...monitorIds.map((monitorId) =>
        this.db
          .insert(schema.monitorNotificationDestinations)
          .values({ monitorId, notificationDestinationId: destinationId }),
      ),
    ];
  }
}

function dedupeIds(ids: string[]) {
  return [...new Set(ids)];
}

export function mapNotificationDestinationRecord(
  row: NotificationDestinationRecordRow,
): NotificationDestinationRecord {
  const provider = readNotificationProvider(row.provider);

  const base = {
    id: row.id,
    name: row.name,
    configJson: row.configJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  switch (provider) {
    case "discord":
      return {
        ...base,
        provider,
        config: parseNotificationConfig(provider, row.configJson),
      };
    case "webhook":
      return {
        ...base,
        provider,
        config: parseNotificationConfig(provider, row.configJson),
      };
    case "telegram":
      return {
        ...base,
        provider,
        config: parseNotificationConfig(provider, row.configJson),
      };
  }
}

function mapNotificationDestinationListItem(
  row: NotificationDestinationRecordRow,
  assignments: Map<string, NotificationDestinationMonitorSummary[]>,
): NotificationDestinationListItem {
  const record = mapNotificationDestinationRecord(row);
  const assignedMonitors = assignments.get(row.id) ?? [];

  return {
    ...record,
    monitorCount: assignedMonitors.length,
    assignedMonitors,
  } satisfies NotificationDestinationListItem;
}

function mapNotificationDestinationDetail(
  row: NotificationDestinationRecordRow,
  assignments: Map<string, NotificationDestinationMonitorSummary[]>,
): NotificationDestinationDetail {
  const record = mapNotificationDestinationRecord(row);
  const assignedMonitors = assignments.get(row.id) ?? [];

  return {
    ...record,
    monitorIds: assignedMonitors.map((monitor) => monitor.id),
  } satisfies NotificationDestinationDetail;
}
