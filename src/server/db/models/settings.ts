import { eq } from "drizzle-orm";

import type { AppSettingsRecord } from "@/types";

import { schema, type DrizzleDatabase } from "@/server/db";
import { nowIso } from "@/server/lib/dates";

const APP_SETTINGS_ID = "default";

export class SettingsModel {
  constructor(private readonly db: DrizzleDatabase) {}

  async get() {
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

  async update(
    payload: Pick<
      AppSettingsRecord,
      "heartbeatRetentionDays" | "incidentRetentionDays"
    >,
  ) {
    const now = nowIso();
    await this.get();
    await this.db
      .update(schema.appSettings)
      .set({
        heartbeatRetentionDays: payload.heartbeatRetentionDays,
        incidentRetentionDays: payload.incidentRetentionDays,
        updatedAt: now,
      })
      .where(eq(schema.appSettings.id, APP_SETTINGS_ID));
    return this.get();
  }

  deleteAll() {
    return this.db.delete(schema.appSettings);
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
