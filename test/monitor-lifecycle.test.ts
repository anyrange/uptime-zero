import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { createAppDb, getDb } from "@/api/db";
import * as schema from "@/api/db/schema";

describe("monitor lifecycle", () => {
  it("records push overdue and recovery transitions through the lifecycle interface", async () => {
    const appDb = createAppDb(env.DB);
    const monitorId = crypto.randomUUID();

    await getDb(env.DB).insert(schema.monitors).values({
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

    const monitor = await appDb.monitor.getById(monitorId);
    expect(monitor).not.toBeNull();
    await appDb.lifecycle.recordPushOverdue(monitor!);

    const downDetail = await appDb.monitor.getDetailData(monitorId);
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

    await appDb.lifecycle.recordPushHeartbeat(downDetail!.monitor);

    const recoveredDetail = await appDb.monitor.getDetailData(monitorId);
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
