import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { env } from "cloudflare:workers";

import { createDatabase } from "@/server/db";
import * as schema from "@/server/db/schema";
import { daysAgoIso } from "@/server/lib/dates";
import { MaintenanceService } from "@/server/services/maintenance";

describe("maintenance retention", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-13T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deletes expired heartbeats and closed incidents but keeps boundary records", async () => {
    const db = createDatabase(env.DB);
    await db.settings.update({
      heartbeatRetentionDays: 1,
      incidentRetentionDays: 1,
    });
    const monitor = await db.monitor.createOrUpdate({
      name: "HTTP",
      kind: "http",
      target: "https://example.com/health",
      intervalSec: 60,
      timeoutMs: 10_000,
      retries: 0,
      assertions: [],
      active: true,
      heartbeatCron: null,
      heartbeatGraceSec: null,
      heartbeatTimezone: null,
      notificationGraceSec: 0,
      notificationDestinationIds: [],
    });
    if (!monitor) {
      throw new Error("Monitor creation should not fail");
    }

    const retentionCutoff = daysAgoIso(1);
    const tooOld = new Date(
      new Date(retentionCutoff).getTime() - 1000,
    ).toISOString();
    const atCutoff = retentionCutoff;
    const fresh = new Date(
      new Date(retentionCutoff).getTime() + 1000,
    ).toISOString();

    const oldHeartbeat = {
      id: crypto.randomUUID(),
      monitorId: monitor.id,
      status: "down" as const,
      statusCode: 500,
      durationMs: 99,
      error: "too old",
      createdAt: tooOld,
      source: "poll" as const,
    };
    const cutOffHeartbeat = {
      id: crypto.randomUUID(),
      monitorId: monitor.id,
      status: "up" as const,
      statusCode: 200,
      durationMs: 100,
      error: null,
      createdAt: atCutoff,
      source: "system" as const,
    };
    const freshHeartbeat = {
      id: crypto.randomUUID(),
      monitorId: monitor.id,
      status: "up" as const,
      statusCode: 200,
      durationMs: 101,
      error: null,
      createdAt: fresh,
      source: "system" as const,
    };

    await db.drizzle.insert(schema.heartbeats).values([
      oldHeartbeat,
      cutOffHeartbeat,
      freshHeartbeat,
    ]);

    const oldClosedIncident = {
      id: crypto.randomUUID(),
      monitorId: monitor.id,
      title: "old closed",
      status: "closed" as const,
      body: null,
      pinned: 0,
      openedAt: tooOld,
      closedAt: tooOld,
    };
    const cutoffClosedIncident = {
      id: crypto.randomUUID(),
      monitorId: monitor.id,
      title: "cutoff closed",
      status: "closed" as const,
      body: null,
      pinned: 0,
      openedAt: tooOld,
      closedAt: atCutoff,
    };
    const openIncident = {
      id: crypto.randomUUID(),
      monitorId: monitor.id,
      title: "open old",
      status: "open" as const,
      body: null,
      pinned: 0,
      openedAt: tooOld,
      closedAt: null,
    };

    await db.drizzle.insert(schema.incidents).values([
      oldClosedIncident,
      cutoffClosedIncident,
      openIncident,
    ]);

    const userId = crypto.randomUUID();
    await db.drizzle.insert(schema.user).values({
      id: userId,
      name: "Expired Keeper",
      email: `${userId}@example.com`,
      emailVerified: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      role: "user",
      image: null,
    });

    const oldSession = {
      id: crypto.randomUUID(),
      userId,
      token: "old-session",
      expiresAt: Date.now() - 1000,
      ipAddress: null,
      userAgent: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const cutoffSession = {
      id: crypto.randomUUID(),
      userId,
      token: "cutoff-session",
      expiresAt: Date.now(),
      ipAddress: null,
      userAgent: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const freshSession = {
      id: crypto.randomUUID(),
      userId,
      token: "fresh-session",
      expiresAt: Date.now() + 1000,
      ipAddress: null,
      userAgent: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.drizzle.insert(schema.session).values([
      oldSession,
      cutoffSession,
      freshSession,
    ]);

    const service = new MaintenanceService(db);
    await service.cleanupRetention();

    const remainingHeartbeats = await db.drizzle
      .select()
      .from(schema.heartbeats);
    const heartbeatIds = new Set(remainingHeartbeats.map((row) => row.id));
    expect(heartbeatIds.has(oldHeartbeat.id)).toBe(false);
    expect(heartbeatIds.has(cutOffHeartbeat.id)).toBe(true);
    expect(heartbeatIds.has(freshHeartbeat.id)).toBe(true);

    const remainingIncidents = await db.drizzle
      .select()
      .from(schema.incidents);
    const incidentStatuses = new Set(remainingIncidents.map((row) => row.status));
    expect(incidentStatuses.has("open")).toBe(true);
    expect(incidentStatuses.has("closed")).toBe(true);
    const incidentIds = new Set(remainingIncidents.map((row) => row.id));
    expect(incidentIds.has(oldClosedIncident.id)).toBe(false);
    expect(incidentIds.has(cutoffClosedIncident.id)).toBe(true);
    expect(incidentIds.has(openIncident.id)).toBe(true);

    const remainingSessions = await db.drizzle
      .select()
      .from(schema.session)
      .where(eq(schema.session.userId, userId));
    expect(remainingSessions).toHaveLength(2);
    const sessionIds = new Set(remainingSessions.map((row) => row.id));
    expect(sessionIds.has(oldSession.id)).toBe(false);
    expect(sessionIds.has(cutoffSession.id)).toBe(true);
    expect(sessionIds.has(freshSession.id)).toBe(true);
  });
});
