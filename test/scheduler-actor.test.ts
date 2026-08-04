import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
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
    vi.useRealTimers();
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

  it("records downtime immediately while notification grace is active", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime("2026-05-01T12:01:00.000Z");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad gateway", { status: 502 })),
    );
    const db = createDatabase(env.DB);
    const alarm = new FakeAlarm();
    const monitor = await seedMonitor({
      kind: "http",
      lastStatus: "up",
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
      intervalSec: 60,
      notificationGraceSec: 10,
    });

    await runDueMonitorsAndReschedule(db, {
      alarm,
      now: parseDateMs("2026-05-01T12:01:00.000Z"),
    });

    const monitorService = new MonitorService(db);
    const detail = await monitorService.getDetailData(monitor.id);

    expect(detail?.monitor.lastStatus).toBe("down");
    expect(detail?.monitor.lastCheckedAt).toBe("2026-05-01T12:01:00.000Z");
    expect(detail?.heartbeats[0]).toMatchObject({
      monitorId: monitor.id,
      source: "poll",
      status: "down",
      statusCode: 502,
    });
    expect(detail?.incidents).toEqual([
      expect.objectContaining({
        monitorId: monitor.id,
        status: "open",
        openedAt: "2026-05-01T12:01:00.000Z",
      }),
    ]);
  });

  it("opens a down incident after consecutive failures exceed notification grace", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime("2026-05-01T12:01:00.000Z");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad gateway", { status: 502 })),
    );
    const db = createDatabase(env.DB);
    const alarm = new FakeAlarm();
    const monitor = await seedMonitor({
      kind: "http",
      lastStatus: "up",
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
      intervalSec: 60,
      notificationGraceSec: 10,
    });

    await runDueMonitorsAndReschedule(db, {
      alarm,
      now: parseDateMs("2026-05-01T12:01:00.000Z"),
    });

    vi.setSystemTime("2026-05-01T12:02:00.000Z");
    await runDueMonitorsAndReschedule(db, {
      alarm,
      now: parseDateMs("2026-05-01T12:02:00.000Z"),
    });

    const monitorService = new MonitorService(db);
    const detail = await monitorService.getDetailData(monitor.id);

    expect(detail?.monitor.lastStatus).toBe("down");
    expect(detail?.heartbeats).toHaveLength(2);
    expect(detail?.incidents).toEqual([
      expect.objectContaining({
        monitorId: monitor.id,
        status: "open",
        title: "API is down",
      }),
    ]);
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

  it("uses a bounded default batch and schedules another near-term alarm", async () => {
    const db = createDatabase(env.DB);
    const alarm = new FakeAlarm();
    const now = parseDateMs("2026-05-01T12:01:00.000Z");
    await seedMonitor({ lastCheckedAt: "2026-05-01T12:00:00.000Z" });
    await seedMonitor({ lastCheckedAt: "2026-05-01T12:00:00.000Z" });
    await seedMonitor({ lastCheckedAt: "2026-05-01T12:00:00.000Z" });

    const result = await runDueMonitorsAndReschedule(db, {
      alarm,
      now,
    });
    const heartbeats = await getDrizzle(env.DB)
      .select()
      .from(schema.heartbeats);

    expect(result).toMatchObject({ active: 3, due: 3, checked: 2 });
    expect(heartbeats).toHaveLength(2);
    expect(result.nextAlarmAt).toBe(now + 1000);
  });

  it("reschedules after an individual monitor task fails", async () => {
    const db = createDatabase(env.DB);
    const alarm = new FakeAlarm();
    const now = parseDateMs("2026-05-01T12:01:00.000Z");
    await seedMonitor({ lastCheckedAt: "2026-05-01T12:00:00.000Z" });

    const result = await runDueMonitorsAndReschedule(db, {
      alarm,
      now,
      executeMonitor: async () => {
        throw new Error("D1 unavailable");
      },
    });

    expect(result).toMatchObject({ checked: 1, failed: 1 });
    expect(result.nextAlarmAt).toBe(now + 30_000);
    expect(alarm.value).toBe(now + 30_000);
  });

  it("aggregates availability beyond the displayed heartbeat sample", async () => {
    const monitor = await seedMonitor();
    const createdAt = new Date().toISOString();
    await env.DB.prepare(
      `WITH RECURSIVE checks(value) AS (
        VALUES(1)
        UNION ALL
        SELECT value + 1 FROM checks WHERE value < 1001
      )
      INSERT INTO heartbeats (
        id, monitorId, status, statusCode, durationMs, error, createdAt, source
      )
      SELECT
        printf('metric-heartbeat-%04d', value),
        ?,
        CASE WHEN value = 1001 THEN 'down' ELSE 'up' END,
        200,
        10,
        NULL,
        ?,
        'poll'
      FROM checks`,
    )
      .bind(monitor.id, createdAt)
      .run();

    const detail = await new MonitorService(
      createDatabase(env.DB),
    ).getDetailData(monitor.id);

    expect(detail?.heartbeats).toHaveLength(1000);
    expect(detail?.metrics.requestCount).toBe(1001);
    expect(detail?.metrics.windows[0]).toMatchObject({
      totalChecks: 1001,
      upChecks: 1000,
    });
  });

  it("re-arms a scheduler alarm when the alarm handler fails", async () => {
    const monitor = await seedMonitor();
    await env.DB.prepare("UPDATE monitors SET assertionsJson = ? WHERE id = ?")
      .bind("{", monitor.id)
      .run();
    const stub = env.SCHEDULER_ACTOR.getByName("installation");
    await runInDurableObject(stub, async (_instance, state) => {
      await state.storage.setAlarm(Date.now());
    });

    await runDurableObjectAlarm(stub);

    await runInDurableObject(stub, async (_instance, state) => {
      expect(await state.storage.getAlarm()).toBeGreaterThan(Date.now());
      await state.storage.deleteAlarm();
    });
  });

  it("retires a shard alarm after initializing the singleton", async () => {
    await seedMonitor();
    const shardStub = env.SCHEDULER_ACTOR.getByName("scheduler:0");
    await runInDurableObject(shardStub, async (_instance, state) => {
      await state.storage.setAlarm(Date.now());
    });

    await runDurableObjectAlarm(shardStub);

    await runInDurableObject(shardStub, async (_instance, state) => {
      expect(await state.storage.getAlarm()).toBeNull();
    });
    const singletonStub = env.SCHEDULER_ACTOR.getByName("installation");
    await runInDurableObject(singletonStub, async (_instance, state) => {
      expect(await state.storage.getAlarm()).not.toBeNull();
    });
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
