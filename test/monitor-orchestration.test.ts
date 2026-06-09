import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import type { MonitorRecord } from "@/types";

import { createAppDb, getDb } from "@/api/db";
import * as schema from "@/api/db/schema";
import { parseDateMs } from "@/api/lib/dates";
import { MonitorOrchestrator } from "@/api/lib/monitor-orchestration";

describe("monitor orchestration", () => {
  it("clears the alarm when the monitor is inactive", async () => {
    const db = createAppDb(env.DB);
    const alarm = new FakeAlarm(parseDateMs("2026-05-01T12:00:00.000Z"));
    const monitor = await seedMonitor({ active: 0 });

    const result = await new MonitorOrchestrator(db, alarm).syncMonitor(
      monitor.id,
    );

    expect(result).toEqual({ ok: true, active: false, scheduledFor: null });
    expect(alarm.value).toBeNull();
    expect(alarm.deleted).toBe(1);
  });

  it("schedules an active monitor during sync", async () => {
    const db = createAppDb(env.DB);
    const alarm = new FakeAlarm();
    const monitor = await seedMonitor({
      kind: "http",
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
      intervalSec: 60,
    });

    const result = await new MonitorOrchestrator(db, alarm).syncMonitor(
      monitor.id,
    );

    expect(result.active).toBe(true);
    expect(result.scheduledFor).toBeGreaterThanOrEqual(
      parseDateMs("2026-05-01T12:01:00.000Z"),
    );
    expect(alarm.value).toBe(result.scheduledFor);
  });

  it("skips an alarm run when the monitor is not due", async () => {
    const db = createAppDb(env.DB);
    const alarm = new FakeAlarm();
    const monitor = await seedMonitor({
      kind: "push",
      lastCheckedAt: new Date(Date.now()).toISOString(),
      intervalSec: 60,
      timeoutMs: 1000,
    });

    const result = await new MonitorOrchestrator(db, alarm).runMonitorNow(
      monitor.id,
      "alarm",
    );
    const detail = await db.monitor.getDetailData(monitor.id);

    expect(result.ran).toBe(false);
    expect(result.scheduledFor).toBeGreaterThan(Date.now());
    expect(detail?.heartbeats).toHaveLength(0);
    expect(alarm.value).toBe(result.scheduledFor);
  });

  it("records a push overdue heartbeat when an alarm run is due", async () => {
    const db = createAppDb(env.DB);
    const alarm = new FakeAlarm();
    const monitor = await seedMonitor({
      kind: "push",
      lastStatus: "up",
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
      intervalSec: 60,
      timeoutMs: 1000,
    });

    const result = await new MonitorOrchestrator(db, alarm).runMonitorNow(
      monitor.id,
      "alarm",
    );
    const detail = await db.monitor.getDetailData(monitor.id);

    expect(result.ran).toBe(true);
    expect(detail?.monitor.lastStatus).toBe("down");
    expect(detail?.heartbeats[0]).toMatchObject({
      monitorId: monitor.id,
      source: "system",
      status: "down",
    });
    expect(alarm.value).toBe(result.scheduledFor);
  });

  it("records a cron heartbeat monitor overdue after the scheduled run plus grace", async () => {
    const db = createAppDb(env.DB);
    const alarm = new FakeAlarm();
    const monitor = await seedMonitor({
      kind: "push",
      lastStatus: "up",
      lastCheckedAt: "2026-05-01T12:05:00.000Z",
      heartbeatMode: "cron",
      heartbeatCron: "0 * * * *",
      heartbeatGraceSec: 60,
      heartbeatTimezone: "UTC",
    });

    const result = await new MonitorOrchestrator(db, alarm).runMonitorNow(
      monitor.id,
      "alarm",
    );
    const detail = await db.monitor.getDetailData(monitor.id);

    expect(result.ran).toBe(true);
    expect(detail?.monitor.lastStatus).toBe("down");
    expect(detail?.heartbeats[0]).toMatchObject({
      source: "system",
      status: "down",
      error:
        "No heartbeat received for the 2026-05-01T13:00:00.000Z schedule within 60s",
    });
  });

  it("records a push heartbeat and reschedules from the reloaded monitor", async () => {
    const db = createAppDb(env.DB);
    const alarm = new FakeAlarm();
    const monitor = await seedMonitor({
      kind: "push",
      lastStatus: "down",
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
    });

    const result = await new MonitorOrchestrator(db, alarm).recordPushHeartbeat(
      monitor.id,
    );
    const detail = await db.monitor.getDetailData(monitor.id);

    expect(result.recorded).toBe(true);
    expect(detail?.monitor.lastStatus).toBe("up");
    expect(detail?.heartbeats[0]).toMatchObject({
      monitorId: monitor.id,
      source: "push",
      status: "up",
    });
    expect(alarm.value).toBe(result.scheduledFor);
    expect(result.scheduledFor).toBeGreaterThan(Date.now());
  });
});

class FakeAlarm {
  value: number | null;
  deleted = 0;

  constructor(value: number | null = null) {
    this.value = value;
  }

  async getAlarm() {
    return this.value;
  }

  async setAlarm(timestamp: number) {
    this.value = timestamp;
  }

  async deleteAlarm() {
    this.value = null;
    this.deleted += 1;
  }
}

async function seedMonitor(payload: Partial<MonitorRecord> = {}) {
  const now = payload.createdAt ?? "2026-05-01T12:00:00.000Z";
  const kind = payload.kind ?? "http";
  const monitor = {
    id: payload.id ?? crypto.randomUUID(),
    name: payload.name ?? "API",
    kind,
    target: payload.target ?? (kind === "push" ? "" : "http://example.com"),
    intervalSec: payload.intervalSec ?? 60,
    timeoutMs: payload.timeoutMs ?? 1000,
    retries: payload.retries ?? 0,
    assertionsJson: JSON.stringify(payload.assertions ?? []),
    heartbeatMode: payload.heartbeatMode ?? "interval",
    heartbeatCron: payload.heartbeatCron ?? null,
    heartbeatGraceSec: payload.heartbeatGraceSec ?? null,
    heartbeatTimezone: payload.heartbeatTimezone ?? null,
    pushToken: kind === "push" ? crypto.randomUUID() : null,
    active: payload.active ?? 1,
    lastStatus: payload.lastStatus ?? "unknown",
    lastCheckedAt: payload.lastCheckedAt ?? null,
    lastDurationMs: payload.lastDurationMs ?? null,
    lastError: payload.lastError ?? null,
    createdAt: now,
    updatedAt: payload.updatedAt ?? now,
  } satisfies typeof schema.monitors.$inferInsert;

  await getDb(env.DB).insert(schema.monitors).values(monitor);

  const db = createAppDb(env.DB);
  const savedMonitor = await db.monitor.getById(monitor.id);
  if (!savedMonitor) {
    throw new Error("Failed to seed monitor");
  }
  return savedMonitor;
}
