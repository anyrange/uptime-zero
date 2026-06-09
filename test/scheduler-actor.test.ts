import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MonitorRecord } from "@/types";

import { createDatabase, getDrizzle } from "@/server/db";
import * as schema from "@/server/db/schema";
import { parseDateMs } from "@/server/lib/dates";
import { MonitorService } from "@/server/services/monitor";
import {
  recordPushHeartbeatAndReschedule,
  runDueMonitorsAndReschedule,
  runMonitorNowAndReschedule,
  syncScheduler,
} from "@/server/services/scheduler";

describe("scheduler actor service", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("ok", { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clears the alarm when no active monitors exist", async () => {
    const db = createDatabase(env.DB);
    const alarm = new FakeAlarm(parseDateMs("2026-05-01T12:00:00.000Z"));

    const result = await syncScheduler(db, {
      alarm,
      now: parseDateMs("2026-05-01T12:00:00.000Z"),
    });

    expect(result).toEqual({ active: 0, nextAlarmAt: null });
    expect(alarm.value).toBeNull();
    expect(alarm.deleted).toBe(1);
  });

  it("schedules the earliest active monitor due time", async () => {
    const db = createDatabase(env.DB);
    const alarm = new FakeAlarm();
    await seedMonitor({
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
      intervalSec: 300,
    });
    await seedMonitor({
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
      intervalSec: 60,
    });

    const result = await syncScheduler(db, {
      alarm,
      now: parseDateMs("2026-05-01T12:00:30.000Z"),
    });

    expect(result.active).toBe(2);
    expect(result.nextAlarmAt).toBe(parseDateMs("2026-05-01T12:01:00.000Z"));
    expect(alarm.value).toBe(result.nextAlarmAt);
  });

  it("records due HTTP checks and reschedules from updated monitor state", async () => {
    const db = createDatabase(env.DB);
    const alarm = new FakeAlarm();
    const monitor = await seedMonitor({
      kind: "http",
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
      intervalSec: 60,
    });

    const result = await runDueMonitorsAndReschedule(db, {
      alarm,
      now: parseDateMs("2026-05-01T12:01:00.000Z"),
    });

    const monitorService = new MonitorService(db);
    const detail = await monitorService.getDetailData(monitor.id);

    expect(result).toMatchObject({ active: 1, due: 1, checked: 1 });
    expect(detail?.monitor.lastStatus).toBe("up");
    expect(detail?.heartbeats[0]).toMatchObject({
      monitorId: monitor.id,
      source: "poll",
      status: "up",
    });
    expect(alarm.value).toBe(result.nextAlarmAt);
  });

  it("skips not-due monitors and keeps their next alarm", async () => {
    const db = createDatabase(env.DB);
    const alarm = new FakeAlarm();
    const monitor = await seedMonitor({
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
      intervalSec: 60,
    });

    const result = await runDueMonitorsAndReschedule(db, {
      alarm,
      now: parseDateMs("2026-05-01T12:00:30.000Z"),
    });

    const monitorService = new MonitorService(db);
    const detail = await monitorService.getDetailData(monitor.id);

    expect(result).toMatchObject({ active: 1, due: 0, checked: 0 });
    expect(detail?.heartbeats).toHaveLength(0);
    expect(result.nextAlarmAt).toBe(parseDateMs("2026-05-01T12:01:00.000Z"));
  });

  it("records push overdue heartbeats when due", async () => {
    const db = createDatabase(env.DB);
    const alarm = new FakeAlarm();
    const monitor = await seedMonitor({
      kind: "push",
      lastStatus: "up",
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
      intervalSec: 60,
      timeoutMs: 1000,
    });

    const result = await runDueMonitorsAndReschedule(db, {
      alarm,
      now: parseDateMs("2026-05-01T12:01:01.000Z"),
    });

    const monitorService = new MonitorService(db);
    const detail = await monitorService.getDetailData(monitor.id);

    expect(result.checked).toBe(1);
    expect(detail?.monitor.lastStatus).toBe("down");
    expect(detail?.heartbeats[0]).toMatchObject({
      monitorId: monitor.id,
      source: "system",
      status: "down",
    });
  });

  it("records cron heartbeat monitor overdue after schedule plus grace", async () => {
    const db = createDatabase(env.DB);
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

    const result = await runDueMonitorsAndReschedule(db, {
      alarm,
      now: parseDateMs("2026-05-01T13:01:00.000Z"),
    });

    const monitorService = new MonitorService(db);
    const detail = await monitorService.getDetailData(monitor.id);

    expect(result.checked).toBe(1);
    expect(detail?.monitor.lastStatus).toBe("down");
    expect(detail?.heartbeats[0]).toMatchObject({
      source: "system",
      status: "down",
      error:
        "No heartbeat received for the 2026-05-01T13:00:00.000Z schedule within 60s",
    });
  });

  it("manual run bypasses due checks", async () => {
    const db = createDatabase(env.DB);
    const alarm = new FakeAlarm();
    const monitor = await seedMonitor({
      lastCheckedAt: new Date().toISOString(),
      intervalSec: 60,
    });

    const result = await runMonitorNowAndReschedule(db, monitor.id, {
      alarm,
      now: Date.now(),
    });

    const monitorService = new MonitorService(db);
    const detail = await monitorService.getDetailData(monitor.id);

    expect(result.ran).toBe(true);
    expect(detail?.heartbeats).toHaveLength(1);
    expect(alarm.value).toBe(result.nextAlarmAt);
  });

  it("records push heartbeats and reschedules", async () => {
    const db = createDatabase(env.DB);
    const alarm = new FakeAlarm();
    const monitor = await seedMonitor({
      kind: "push",
      lastStatus: "down",
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
    });

    const result = await recordPushHeartbeatAndReschedule(db, monitor.id, {
      alarm,
      now: Date.now(),
    });

    const monitorService = new MonitorService(db);
    const detail = await monitorService.getDetailData(monitor.id);

    expect(result.ran).toBe(true);
    expect(detail?.monitor.lastStatus).toBe("up");
    expect(detail?.heartbeats[0]).toMatchObject({
      monitorId: monitor.id,
      source: "push",
      status: "up",
    });
    expect(alarm.value).toBe(result.nextAlarmAt);
  });

  it("honors batch limits and schedules another near-term alarm", async () => {
    const db = createDatabase(env.DB);
    const alarm = new FakeAlarm();
    const now = parseDateMs("2026-05-01T12:01:00.000Z");
    await seedMonitor({ lastCheckedAt: "2026-05-01T12:00:00.000Z" });
    await seedMonitor({ lastCheckedAt: "2026-05-01T12:00:00.000Z" });
    await seedMonitor({ lastCheckedAt: "2026-05-01T12:00:00.000Z" });

    const result = await runDueMonitorsAndReschedule(db, {
      alarm,
      now,
      batchSize: 2,
    });
    const heartbeats = await getDrizzle(env.DB)
      .select()
      .from(schema.heartbeats);

    expect(result).toMatchObject({ active: 3, due: 3, checked: 2 });
    expect(heartbeats).toHaveLength(2);
    expect(result.nextAlarmAt).toBe(now + 1000);
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
    notificationGraceSec: payload.notificationGraceSec ?? 0,
    pushToken: kind === "push" ? crypto.randomUUID() : null,
    active: payload.active ?? 1,
    lastStatus: payload.lastStatus ?? "unknown",
    lastCheckedAt: payload.lastCheckedAt ?? null,
    lastDurationMs: payload.lastDurationMs ?? null,
    lastError: payload.lastError ?? null,
    lastDownNotifiedAt: payload.lastDownNotifiedAt ?? null,
    createdAt: now,
    updatedAt: payload.updatedAt ?? now,
  } satisfies typeof schema.monitors.$inferInsert;

  await getDrizzle(env.DB).insert(schema.monitors).values(monitor);

  const db = createDatabase(env.DB);
  const savedMonitor = await db.monitor.getById(monitor.id);
  if (!savedMonitor) {
    throw new Error("Failed to seed monitor");
  }
  return savedMonitor;
}
