import "@tanstack/react-start/server-only";
import * as schema from "@schema";
import dayjs from "dayjs";
import { db, eq } from "void/db";

import type { RetentionSettings } from "@/lib/schemas/settings";

/** The installation's single settings row, created lazily on first read. */

const SETTINGS_ID = "default";

const DEFAULT_RETENTION: RetentionSettings = {
  heartbeatRetentionDays: 30,
  incidentRetentionDays: 90,
};

export async function get() {
  const [row] = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.id, SETTINGS_ID));

  if (row) return row;

  const created = {
    id: SETTINGS_ID,
    ...DEFAULT_RETENTION,
    updatedAt: dayjs().toISOString(),
  };

  await db.insert(schema.appSettings).values(created).onConflictDoNothing();

  return created;
}

export async function saveRetention(retention: RetentionSettings) {
  await get();
  await db
    .update(schema.appSettings)
    .set({ ...retention, updatedAt: dayjs().toISOString() })
    .where(eq(schema.appSettings.id, SETTINGS_ID));

  return get();
}
