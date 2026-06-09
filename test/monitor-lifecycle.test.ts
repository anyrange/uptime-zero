import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { createDatabase, getDrizzle } from "@/server/db";
import * as schema from "@/server/db/schema";
import { MonitorService } from "@/server/services/monitor";
import { MonitorLifecycle } from "@/server/services/monitor-lifecycle";

describe("monitor lifecycle", () => {
  it("records push overdue and recovery transitions through the lifecycle interface", async () => {
    const db = createDatabase(env.DB);
    const monitorId = crypto.randomUUID();

    await getDrizzle(env.DB).insert(schema.monitors).values({
      id: monitorId,
      name: "Push API",
      kind: "push",
      target: "",
      intervalSec: 60,
      timeoutMs: 1000,
      retries: 0,
      assertionsJson: "[]",
      pushToken: crypto.randomUUID(),
      active: 1,
      lastStatus: "up",
      lastCheckedAt: "2026-05-01T12:00:00.000Z",
      lastDurationMs: 0,
      lastError: null,
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z",
    });

    const monitor = await db.monitor.getById(monitorId);
    expect(monitor).not.toBeNull();

    const lifecycle = new MonitorLifecycle(db);
    await lifecycle.recordPushOverdue(monitor!);

    const monitorService = new MonitorService(db);
    const downDetail = await monitorService.getDetailData(monitorId);

    expect(downDetail?.monitor.lastStatus).toBe("down");
    expect(downDetail?.heartbeats).toHaveLength(1);
    expect(downDetail?.heartbeats[0]).toMatchObject({
      monitorId,
      source: "system",
      status: "down",
    });
    expect(downDetail?.incidents).toEqual([
      expect.objectContaining({
        monitorId,
        status: "open",
        title: "Push API is down",
      }),
    ]);

    await lifecycle.recordPushHeartbeat(downDetail!.monitor);

    const recoveredDetail = await monitorService.getDetailData(monitorId);
    expect(recoveredDetail?.monitor.lastStatus).toBe("up");
    expect(recoveredDetail?.heartbeats).toHaveLength(2);
    expect(recoveredDetail?.heartbeats[0]).toMatchObject({
      monitorId,
      source: "push",
      status: "up",
    });
    expect(recoveredDetail?.incidents[0]).toMatchObject({
      monitorId,
      status: "closed",
      closedAt: expect.any(String),
    });
  });
});
