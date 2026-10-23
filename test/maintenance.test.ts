import * as schema from "@schema";
import { describe, expect, it } from "vitest";
import { db, eq } from "void/db";

import * as maintenance from "@/modules/maintenance/maintenance.service";
import * as settings from "@/modules/settings/settings.service";

import { seedMonitor, setNow } from "./support";

const NOW = Date.parse("2026-06-13T00:00:00.000Z");

// Retention is one day, so the cutoff sits exactly one day before `NOW`.
const CUTOFF = NOW - 86_400_000;

const iso = (ms: number) => new Date(ms).toISOString();

const daysBefore = (days: number) => iso(NOW - days * 86_400_000).slice(0, 10);

const idsOf = (rows: ReadonlyArray<{ id: string }>) =>
  new Set(rows.map((row) => row.id));

describe("maintenance retention", () => {
  it("deletes expired records but keeps the ones on the boundary", async () => {
    setNow(iso(NOW));

    await settings.updateRetention({
      heartbeatRetentionDays: 1,
      incidentRetentionDays: 1,
    });

    const monitor = await seedMonitor();
    const tooOld = iso(CUTOFF - 1000);
    const atCutoff = iso(CUTOFF);
    const fresh = iso(CUTOFF + 1000);

    const heartbeat = (createdAt: string, status: "up" | "down") => ({
      id: crypto.randomUUID(),
      monitorId: monitor.id,
      status,
      statusCode: status === "up" ? 200 : 500,
      durationMs: 100,
      error: null,
      createdAt,
      source: "poll" as const,
    });

    const heartbeats = {
      old: heartbeat(tooOld, "down"),
      cutoff: heartbeat(atCutoff, "up"),
      fresh: heartbeat(fresh, "up"),
    };

    await db.insert(schema.heartbeats).values(Object.values(heartbeats));

    // Rollups back the one-year availability window: they are kept for
    // 366 days regardless of the heartbeat retention.
    const rollup = (day: string) => ({
      monitorId: monitor.id,
      day,
      total: 1,
      up: 1,
      down: 0,
      unknown: 0,
    });

    await db
      .insert(schema.heartbeatDaily)
      .values([
        rollup(daysBefore(367)),
        rollup(daysBefore(366)),
        rollup(daysBefore(1)),
      ]);

    const incident = (status: "open" | "closed", closedAt: string | null) => ({
      id: crypto.randomUUID(),
      monitorId: monitor.id,
      title: "Outage",
      status,
      body: null,
      pinned: false,
      openedAt: tooOld,
      closedAt,
    });

    const incidents = {
      oldClosed: incident("closed", tooOld),
      cutoffClosed: incident("closed", atCutoff),
      openOld: incident("open", null),
    };

    await db.insert(schema.incidents).values(Object.values(incidents));

    const userId = crypto.randomUUID();
    const createdAt = new Date(NOW);

    await db.insert(schema.user).values({
      id: userId,
      name: "Expired Keeper",
      email: `${userId}@example.com`,
      emailVerified: true,
      role: "user",
      createdAt,
      updatedAt: createdAt,
    });

    const session = (token: string, expiresAt: number) => ({
      id: crypto.randomUUID(),
      userId,
      token,
      expiresAt: new Date(expiresAt),
      createdAt,
      updatedAt: createdAt,
    });

    const sessions = {
      expired: session("expired", NOW - 1000),
      expiringNow: session("expiring-now", NOW),
      fresh: session("fresh", NOW + 1000),
    };

    await db.insert(schema.session).values(Object.values(sessions));

    await maintenance.applyRetention();

    const heartbeatIds = idsOf(await db.select().from(schema.heartbeats));
    const incidentIds = idsOf(await db.select().from(schema.incidents));
    const sessionIds = idsOf(await db.select().from(schema.session));

    const rollupDays = (
      await db
        .select({ day: schema.heartbeatDaily.day })
        .from(schema.heartbeatDaily)
        .where(eq(schema.heartbeatDaily.monitorId, monitor.id))
    ).map((row) => row.day);

    expect(heartbeatIds).toEqual(
      new Set([heartbeats.cutoff.id, heartbeats.fresh.id]),
    );
    expect(incidentIds).toEqual(
      new Set([incidents.cutoffClosed.id, incidents.openOld.id]),
    );
    expect(sessionIds).toEqual(
      new Set([sessions.expiringNow.id, sessions.fresh.id]),
    );
    expect(new Set(rollupDays)).toEqual(
      new Set([daysBefore(366), daysBefore(1)]),
    );
  });
});
