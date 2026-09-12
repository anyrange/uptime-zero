import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import {
  monitorConfigSchema,
  parseMonitorConfigForStorage,
} from "@/lib/monitor/config";
import { createDatabase, schema } from "@/server/db";
import { MonitorLifecycle } from "@/server/services/monitor-lifecycle";
import { deliverPendingNotifications } from "@/server/services/notifications/outbox";
import { runDueMonitorsAndReschedule } from "@/server/services/scheduler";

import { apiFetch } from "./api-test-utils";

const alarm = {
  getAlarm: async () => null,
  setAlarm: async (_timestamp: number) => {},
  deleteAlarm: async () => {},
};

async function createMonitor(name = "Job") {
  const db = createDatabase(env.DB);

  const monitor = await db.monitor.create(
    parseMonitorConfigForStorage(
      monitorConfigSchema.parse({ name, kind: "push" }),
    ),
  );

  if (!monitor) throw new Error("Monitor was not created");

  return monitor;
}

async function setup(email: string) {
  return apiFetch("/api/auth/setup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": "192.0.2.1",
    },
    body: JSON.stringify({
      name: "Administrator",
      email,
      password: "ReviewPassword123!",
    }),
  });
}

describe("server reliability", () => {
  it("public status does not expose credentials, assertions or hidden targets", async () => {
    const db = createDatabase(env.DB);
    const monitor = await createMonitor();
    await db.statusPage.createOrUpdate({
      slug: "public",
      title: "Status",
      published: 1,
      showHistory: 0,
      showTarget: 0,
      monitorIds: [monitor.id],
    });
    const response = await apiFetch("/api/status/public");
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({
      monitors: [{ id: monitor.id, target: null }],
      history: [],
    });
    expect(JSON.stringify(data)).not.toContain(monitor.pushToken);
    expect(data).not.toHaveProperty("heartbeats");
    expect(data).toHaveProperty("uptime");
  });

  it("only one concurrent setup succeeds", async () => {
    const responses = await Promise.all([
      setup("first@example.com"),
      setup("second@example.com"),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(
      await env.DB.prepare(
        "SELECT count(*) AS count FROM user WHERE role = 'admin'",
      ).first("count"),
    ).toBe(1);
  });

  it("rate limits the custom login endpoint", async () => {
    let response: Response | undefined;

    for (let index = 0; index < 11; index++) {
      response = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "192.0.2.22",
        },
        body: JSON.stringify({
          email: "missing@example.com",
          password: "incorrect",
        }),
      });
    }

    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toBe("60");
  });

  it("new push monitors wait for their first heartbeat deadline", async () => {
    const auth = await setup("admin@example.com");

    const cookie = auth.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");

    const response = await apiFetch("/api/monitors", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        name: "New job",
        kind: "push",
        intervalSec: 3600,
      }),
    });

    expect(response.status).toBe(201);
    const db = createDatabase(env.DB);
    const [monitor] = await db.monitor.listAll();
    expect(monitor.lastStatus).toBe("unknown");
    expect(await db.incident.countOpen()).toBe(0);
  });

  it("rejects invalid cron imports before saving anything", async () => {
    const auth = await setup("admin@example.com");

    const cookie = auth.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");

    const response = await apiFetch("/api/settings/monitors/import", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        kind: "uptime-monitor-export",
        version: 1,
        exportedAt: new Date().toISOString(),
        monitors: [
          {
            name: "Broken",
            kind: "push",
            heartbeatMode: "cron",
            heartbeatCron: "invalid",
            heartbeatTimezone: "UTC",
          },
        ],
      }),
    });

    expect(response.status).toBe(400);
    expect(await createDatabase(env.DB).monitor.listAll()).toEqual([]);
  });

  it("rolls back the heartbeat and state when incident persistence fails", async () => {
    const monitor = await createMonitor();
    await env.DB.exec(
      "CREATE TRIGGER reject_incident BEFORE INSERT ON incidents BEGIN SELECT RAISE(ABORT, 'simulated failure'); END",
    );
    const db = createDatabase(env.DB);
    await expect(
      new MonitorLifecycle(db).recordPushOverdue(monitor),
    ).rejects.toThrow();
    expect((await db.monitor.getById(monitor.id))?.lastStatus).toBe("unknown");
    expect(await db.monitor.countHeartbeats(monitor.id)).toBe(0);
    await env.DB.exec("DROP TRIGGER reject_incident");
    await new MonitorLifecycle(db).recordPushOverdue(monitor);
    expect(await db.incident.countOpen()).toBe(1);
  });

  it("ignores a check result after the monitor was paused", async () => {
    const monitor = await createMonitor();
    const db = createDatabase(env.DB);
    await db.monitor.setActive(monitor.id, false);
    await new MonitorLifecycle(db).recordPushOverdue(monitor);
    expect(await db.monitor.countHeartbeats(monitor.id)).toBe(0);
    expect(await db.incident.countOpen()).toBe(0);
    expect(await db.monitor.setActive("missing", true)).toBeNull();
  });

  it("backs off failed checks without starving later monitors", async () => {
    await Promise.all([
      createMonitor("First"),
      createMonitor("Second"),
      createMonitor("Third"),
    ]);
    const db = createDatabase(env.DB);
    const now = Date.now() + 7200000;
    const seen = new Set<string>();

    const executeMonitor = async (monitor: { id: string }) => {
      seen.add(monitor.id);
      throw new Error("simulated failure");
    };

    await runDueMonitorsAndReschedule(db, { alarm, now, executeMonitor });
    await runDueMonitorsAndReschedule(db, {
      alarm,
      now: now + 1000,
      executeMonitor,
    });
    expect(seen.size).toBe(3);
  });

  it("retries only failed destinations and retains failed recovery deliveries", async () => {
    const monitor = await createMonitor();
    const db = createDatabase(env.DB);
    await db.notification.create(
      "First",
      "webhook",
      { url: "https://first.example" },
      [monitor.id],
    );
    await db.notification.create(
      "Second",
      "webhook",
      { url: "https://second.example" },
      [monitor.id],
    );
    const lifecycle = new MonitorLifecycle(db);
    await lifecycle.recordPushOverdue(monitor);

    const fetchMock = vi.fn<typeof fetch>(
      async (input) =>
        new Response(null, {
          status: String(input).includes("second") ? 503 : 200,
        }),
    );

    await deliverPendingNotifications(db, fetchMock);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await deliverPendingNotifications(db, fetchMock);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const updated = await db.monitor.getById(monitor.id);
    await lifecycle.recordPushHeartbeat(updated!);
    fetchMock.mockImplementation(
      async () => new Response(null, { status: 503 }),
    );
    await deliverPendingNotifications(db, fetchMock);

    const recovery = await db.drizzle
      .select()
      .from(schema.notificationDeliveries)
      .where(
        and(
          eq(schema.notificationDeliveries.monitorId, monitor.id),
          eq(schema.notificationDeliveries.status, "up"),
        ),
      );

    expect(recovery).toHaveLength(1);
    expect(recovery[0]).toMatchObject({ deliveredAt: null, attempts: 1 });
  });
});
