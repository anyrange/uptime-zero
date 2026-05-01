import { eq, sql } from "drizzle-orm";

import type { AppSettingsRecord } from "@/types";

import { schema, type AppDrizzleDb } from "@/api/db";
import { daysAgoIso, nowIso, nowMs } from "@/api/lib/dates";

const APP_SETTINGS_ID = "default";

export class MaintenanceModel {
  constructor(private readonly db: AppDrizzleDb) {}

  async cleanupRetention() {
    const settings = await this.getAppSettings();
    const heartbeatCutoff = daysAgoIso(settings.heartbeatRetentionDays);
    const incidentCutoff = daysAgoIso(settings.incidentRetentionDays);
    await this.db
      .delete(schema.heartbeats)
      .where(sql`${schema.heartbeats.createdAt} < ${heartbeatCutoff}`);
    await this.db
      .delete(schema.incidents)
      .where(
        sql`${schema.incidents.status} = 'closed' AND ${schema.incidents.closedAt} < ${incidentCutoff}`,
      );
    await this.db
      .delete(schema.session)
      .where(sql`${schema.session.expiresAt} < ${nowMs()}`);
  }

  private async getAppSettings() {
    const existing = await this.db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.id, APP_SETTINGS_ID))
      .get();
    if (existing) {
      return mapAppSettingsRecord(existing);
    }

    const now = nowIso();
    await this.db.insert(schema.appSettings).values({
      id: APP_SETTINGS_ID,
      heartbeatRetentionDays: 30,
      incidentRetentionDays: 90,
      updatedAt: now,
    });

    return mapAppSettingsRecord({
      id: APP_SETTINGS_ID,
      heartbeatRetentionDays: 30,
      incidentRetentionDays: 90,
      updatedAt: now,
    });
  }
}

type AppSettingsRow = typeof schema.appSettings.$inferSelect;

function mapAppSettingsRecord(row: AppSettingsRow) {
  return {
    id: row.id,
    heartbeatRetentionDays: row.heartbeatRetentionDays,
    incidentRetentionDays: row.incidentRetentionDays,
    updatedAt: row.updatedAt,
  } satisfies AppSettingsRecord;
}
