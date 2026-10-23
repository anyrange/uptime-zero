import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import * as incidents from "@/modules/incidents/incidents.service";
import * as monitors from "@/modules/monitors/monitors.service";

import { respondWith, seedMonitor, setNow } from "./support";

async function heartbeatsOf(monitorId: string) {
  return (await monitors.logs(monitorId, 1)).heartbeats;
}

describe("monitors.due", () => {
  it("returns due active monitors, earliest first", async () => {
    setNow("2026-05-01T12:05:00.000Z");

    const later = await seedMonitor({
      lastCheckedAt: "2026-05-01T12:03:00.000Z",
    });

    const earlier = await seedMonitor({
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
    });

    await seedMonitor({ lastCheckedAt: "2026-05-01T12:04:30.000Z" });
    await seedMonitor({
      active: false,
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
    });

    const due = await monitors.due();

    expect(due.map((monitor) => monitor.id)).toEqual([earlier.id, later.id]);
  });

  it("skips monitors that are backing off", async () => {
    setNow("2026-05-01T12:05:00.000Z");
    await seedMonitor({
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
      retryAt: Date.parse("2026-05-01T12:05:30.000Z"),
    });

    expect(await monitors.due()).toHaveLength(0);
  });
});

describe("monitors.runScheduledCheck", () => {
  it("records a due HTTP check", async () => {
    setNow("2026-05-01T12:01:00.000Z");
    respondWith(200);

    const monitor = await seedMonitor({
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
    });

    expect(await monitors.runScheduledCheck(monitor.id)).toBe("checked");

    const saved = await monitors.get(monitor.id);
    const [heartbeat] = await heartbeatsOf(monitor.id);

    expect(saved.lastStatus).toBe("up");
    expect(heartbeat).toMatchObject({ source: "poll", status: "up" });
  });

  it("opens an incident on the first failed check", async () => {
    setNow("2026-05-01T12:01:00.000Z");
    respondWith(502, "bad gateway");

    const monitor = await seedMonitor({
      lastStatus: "up",
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
    });

    await monitors.runScheduledCheck(monitor.id);

    const [heartbeat] = await heartbeatsOf(monitor.id);

    expect(heartbeat).toMatchObject({ status: "down", statusCode: 502 });
    expect(await incidents.forMonitor(monitor.id)).toEqual([
      expect.objectContaining({
        status: "open",
        title: "API is down",
        openedAt: "2026-05-01T12:01:00.000Z",
      }),
    ]);
  });

  it("skips stale messages for paused or not-yet-due monitors", async () => {
    setNow("2026-05-01T12:00:30.000Z");

    const notDue = await seedMonitor({
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
    });

    const paused = await seedMonitor({
      active: false,
      lastCheckedAt: "2026-05-01T11:00:00.000Z",
    });

    expect(await monitors.runScheduledCheck(notDue.id)).toBe("skipped");
    expect(await monitors.runScheduledCheck(paused.id)).toBe("skipped");
    expect(await monitors.runScheduledCheck("missing")).toBe("skipped");
    expect(await heartbeatsOf(notDue.id)).toHaveLength(0);
  });

  it("marks push monitors down once their interval lapses", async () => {
    setNow("2026-05-01T12:01:01.000Z");

    const monitor = await seedMonitor({
      kind: "push",
      lastStatus: "up",
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
    });

    await monitors.runScheduledCheck(monitor.id);

    const [heartbeat] = await heartbeatsOf(monitor.id);

    expect(heartbeat).toMatchObject({ source: "system", status: "down" });
  });

  it("marks cron heartbeats down after schedule plus grace", async () => {
    setNow("2026-05-01T13:01:00.000Z");

    const monitor = await seedMonitor({
      kind: "push",
      lastStatus: "up",
      lastCheckedAt: "2026-05-01T12:05:00.000Z",
      heartbeatMode: "cron",
      heartbeatCron: "0 * * * *",
      heartbeatGraceSec: 60,
      heartbeatTimezone: "UTC",
    });

    await monitors.runScheduledCheck(monitor.id);

    const [heartbeat] = await heartbeatsOf(monitor.id);

    expect(heartbeat).toMatchObject({
      source: "system",
      status: "down",
      error:
        "No heartbeat received for the 2026-05-01T13:00:00.000Z schedule within 60s",
    });
  });

  it("backs off a check that could not be persisted", async () => {
    setNow("2026-05-01T12:01:00.000Z");
    respondWith(200);

    const monitor = await seedMonitor({
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
    });

    // Every accepted check also updates the daily rollup.
    await env.DB.prepare("DROP TABLE heartbeatDaily").run();

    expect(await monitors.runScheduledCheck(monitor.id)).toBe("failed");

    const saved = await monitors.get(monitor.id);

    expect(saved.retryAt).toBe(Date.parse("2026-05-01T12:01:30.000Z"));
    expect(await monitors.due()).toHaveLength(0);
  });
});

describe("push heartbeats", () => {
  it("records the monitor as up", async () => {
    setNow("2026-05-01T12:00:30.000Z");

    const monitor = await seedMonitor({
      kind: "push",
      lastStatus: "down",
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
    });

    await monitors.recordHeartbeat(monitor.pushToken ?? "");

    const saved = await monitors.get(monitor.id);
    const [heartbeat] = await heartbeatsOf(monitor.id);

    expect(saved.lastStatus).toBe("up");
    expect(heartbeat).toMatchObject({ source: "push", status: "up" });
  });

  it("rejects unknown tokens and ignores paused monitors", async () => {
    setNow("2026-05-01T12:00:30.000Z");
    const paused = await seedMonitor({ kind: "push", active: false });

    expect(await monitors.recordHeartbeat("unknown")).toBeNull();

    await monitors.recordHeartbeat(paused.pushToken ?? "");

    expect(await heartbeatsOf(paused.id)).toHaveLength(0);
  });
});
