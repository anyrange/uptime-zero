import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import type { CheckResult } from "@/modules/monitors/probe";

import { monitorConfigDefaults } from "@/lib/schemas/monitor-config";
import * as incidents from "@/modules/incidents/incidents.service";
import * as repo from "@/modules/monitors/monitors.repository";
import * as monitors from "@/modules/monitors/monitors.service";

import { seedMonitor, setNow } from "./support";

const down: CheckResult = {
  status: "down",
  statusCode: null,
  durationMs: 0,
  error: "No heartbeat received in the last 60s",
};

async function loadState(monitorId: string) {
  return {
    monitor: await monitors.get(monitorId),
    heartbeats: (await monitors.logs(monitorId, 1)).heartbeats,
    incidents: await incidents.forMonitor(monitorId),
  };
}

describe("monitor lifecycle", () => {
  it("opens an incident when a push heartbeat is overdue and closes it on recovery", async () => {
    setNow("2026-05-01T12:02:00.000Z");

    const seeded = await seedMonitor({
      name: "Push API",
      kind: "push",
      lastStatus: "up",
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
    });

    expect(await monitors.runScheduledCheck(seeded.id)).toBe("checked");

    const overdue = await loadState(seeded.id);

    expect(overdue.monitor.lastStatus).toBe("down");
    expect(overdue.heartbeats).toEqual([
      expect.objectContaining({ source: "system", status: "down" }),
    ]);
    expect(overdue.incidents).toEqual([
      expect.objectContaining({ status: "open", title: "Push API is down" }),
    ]);

    setNow("2026-05-01T12:02:30.000Z");
    await monitors.recordHeartbeat(seeded.pushToken ?? "");

    const recovered = await loadState(seeded.id);

    expect(recovered.monitor.lastStatus).toBe("up");
    expect(recovered.heartbeats).toHaveLength(2);
    expect(recovered.heartbeats[0]).toMatchObject({
      source: "push",
      status: "up",
    });
    expect(recovered.incidents).toEqual([
      expect.objectContaining({
        status: "closed",
        closedAt: "2026-05-01T12:02:30.000Z",
      }),
    ]);
  });

  it("rolls back the heartbeat and state when incident persistence fails", async () => {
    const monitor = await seedMonitor({ kind: "push" });

    const record = () =>
      repo.recordCheck(monitor, down, "system", "2026-05-01T12:02:00.000Z");

    await env.DB.exec(
      "CREATE TRIGGER reject_incident BEFORE INSERT ON incidents BEGIN SELECT RAISE(ABORT, 'simulated failure'); END",
    );

    await expect(record()).rejects.toThrow();

    const failed = await loadState(monitor.id);

    expect(failed.monitor.lastStatus).toBe("unknown");
    expect(failed.heartbeats).toHaveLength(0);

    await env.DB.exec("DROP TRIGGER reject_incident");
    await record();

    expect(await incidents.countOpen()).toBe(1);
  });

  it("discards a result once the monitor was paused or edited", async () => {
    const paused = await seedMonitor({ kind: "push" });
    const edited = await seedMonitor({ kind: "push" });

    await monitors.setActive(paused.id, false);
    await monitors.update(edited.id, {
      ...monitorConfigDefaults(edited),
      name: "Renamed",
    });

    for (const stale of [paused, edited]) {
      await repo.recordCheck(stale, down, "system", "2026-05-01T12:02:00.000Z");

      expect((await monitors.logs(stale.id, 1)).heartbeats).toHaveLength(0);
    }

    expect(await incidents.countOpen()).toBe(0);
  });
});
