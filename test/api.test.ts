import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { getDrizzle } from "@/server/db";
import * as schema from "@/server/db/schema";

import {
  apiFetch,
  downgradeAdminToUser,
  seedMonitorWithHeartbeats,
  setupAdminSession,
} from "./api-test-utils";

describe("private API auth", () => {
  it("rejects unauthenticated private API requests", async () => {
    const response = await apiFetch("/api/settings/monitors/export");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "Authentication required",
    });
  });

  it("rejects non-admin users from admin API routes", async () => {
    const cookie = await setupAdminSession();
    await downgradeAdminToUser();

    const response = await apiFetch("/api/settings/monitors/export", cookie);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Permission denied",
    });
  });
});

describe("monitor import/export API", () => {
  it("exports only monitor configuration fields", async () => {
    const cookie = await setupAdminSession();
    const monitorId = await seedMonitorWithHeartbeats(1);

    const response = await apiFetch("/api/settings/monitors/export", cookie);

    expect(response.status).toBe(200);
    const exported = (await response.json()) as {
      kind: string;
      version: number;
      monitors: Array<Record<string, unknown>>;
    };
    expect(exported).toMatchObject({
      kind: "uptime-monitor-export",
      version: 1,
      monitors: [
        {
          name: "API",
          kind: "http",
          target: "https://example.com/health",
          intervalSec: 60,
          timeoutMs: 10000,
          retries: 0,
          assertions: [],
          active: true,
        },
      ],
    });
    const exportedMonitor = exported.monitors[0];
    expect(exportedMonitor).not.toHaveProperty("id", monitorId);
    expect(exportedMonitor).not.toHaveProperty("pushToken");
    expect(exportedMonitor).not.toHaveProperty("lastStatus");
    expect(exportedMonitor).not.toHaveProperty("lastCheckedAt");
    expect(exportedMonitor).not.toHaveProperty("createdAt");
    expect(exportedMonitor).not.toHaveProperty("notificationDestinationIds");
  });

  it("imports monitors as new rows and regenerates push tokens", async () => {
    const cookie = await setupAdminSession();
    const db = getDrizzle(env.DB);
    const existingPushId = crypto.randomUUID();

    await db.insert(schema.monitors).values({
      id: existingPushId,
      name: "Push source",
      kind: "push",
      target: "",
      intervalSec: 60,
      timeoutMs: 10000,
      retries: 0,
      assertionsJson: "[]",
      pushToken: "original-token",
      active: 1,
      lastStatus: "unknown",
      lastCheckedAt: null,
      lastDurationMs: null,
      lastError: null,
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z",
    });

    const importResponse = await apiFetch("/api/settings/monitors/import", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        kind: "uptime-monitor-export",
        version: 1,
        exportedAt: "2026-05-07T00:00:00.000Z",
        monitors: [
          {
            name: "HTTP copy",
            kind: "http",
            target: "http://example.com/health",
            intervalSec: 60,
            timeoutMs: 10000,
            retries: 0,
            assertions: [{ id: "status", type: "status", expected: 200 }],
            active: true,
          },
          {
            name: "Push source",
            kind: "push",
            target: "",
            intervalSec: 60,
            timeoutMs: 10000,
            retries: 0,
            assertions: [],
            active: true,
          },
        ],
      }),
    });

    expect(importResponse.status).toBe(200);
    await expect(importResponse.json()).resolves.toMatchObject({
      imported: 2,
      monitors: [
        expect.objectContaining({ name: "HTTP copy" }),
        expect.objectContaining({ name: "Push source", kind: "push" }),
      ],
    });

    const rows = await db.select().from(schema.monitors);
    expect(rows).toHaveLength(3);
    const pushRows = rows.filter((row) => row.kind === "push");
    expect(pushRows).toHaveLength(2);
    expect(pushRows.map((row) => row.pushToken)).toContain("original-token");
    expect(
      pushRows.some(
        (row) =>
          row.id !== existingPushId && row.pushToken !== "original-token",
      ),
    ).toBe(true);

    const httpImport = rows.find((row) => row.name === "HTTP copy");
    expect(httpImport?.lastCheckedAt).toEqual(expect.any(String));
    const heartbeats = await db.select().from(schema.heartbeats);
    expect(heartbeats).toEqual([
      expect.objectContaining({ monitorId: httpImport?.id }),
    ]);
  });

  it("imports legacy monitor exports with shorter positive intervals", async () => {
    const cookie = await setupAdminSession();
    const db = getDrizzle(env.DB);

    const importResponse = await apiFetch("/api/settings/monitors/import", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        kind: "uptime-monitor-export",
        version: 1,
        exportedAt: "2026-05-07T00:00:00.000Z",
        monitors: [
          {
            name: "Legacy API",
            kind: "http",
            target: "http://example.com/health",
            intervalSec: 20,
            timeoutMs: 10000,
            retries: 0,
            assertions: [],
            active: true,
          },
        ],
      }),
    });

    expect(importResponse.status).toBe(200);
    await expect(importResponse.json()).resolves.toMatchObject({
      imported: 1,
      monitors: [expect.objectContaining({ name: "Legacy API" })],
    });

    const rows = await db.select().from(schema.monitors);
    expect(rows).toEqual([
      expect.objectContaining({
        name: "Legacy API",
        intervalSec: 60,
      }),
    ]);
  });

  it("rejects invalid import envelopes and monitor payloads", async () => {
    const cookie = await setupAdminSession();

    const invalidJson = await apiFetch("/api/settings/monitors/import", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: "{",
    });
    expect(invalidJson.status).toBe(400);

    const badEnvelope = await apiFetch("/api/settings/monitors/import", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        kind: "wrong",
        version: 1,
        exportedAt: "2026-05-07T00:00:00.000Z",
        monitors: [],
      }),
    });
    expect(badEnvelope.status).toBe(400);

    const badMonitor = await apiFetch("/api/settings/monitors/import", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        kind: "uptime-monitor-export",
        version: 1,
        exportedAt: "2026-05-07T00:00:00.000Z",
        monitors: [
          {
            name: "",
            kind: "http",
            target: "http://example.com",
            intervalSec: 0,
            timeoutMs: 10000,
            retries: 0,
            assertions: [],
            active: true,
          },
        ],
      }),
    });
    expect(badMonitor.status).toBe(400);
  });
});

describe("monitor API", () => {
  it("creates and updates monitors through the real API and D1 models", async () => {
    const cookie = await setupAdminSession();

    const createResponse = await apiFetch("/api/monitors", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        name: "API",
        kind: "http",
        target: "https://example.com/health",
        intervalSec: 60,
        timeoutMs: 10000,
        retries: 1,
        active: false,
        assertions: [{ id: "status", type: "status", expected: 200 }],
      }),
    });

    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as { id: string };
    expect(created).toMatchObject({
      name: "API",
      kind: "http",
      active: 0,
      assertions: [{ id: "status", type: "status", expected: 200 }],
    });

    const updateResponse = await apiFetch(`/api/monitors/${created.id}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        name: "API edge",
        kind: "http",
        target: "https://example.com/ready",
        intervalSec: 120,
        timeoutMs: 5000,
        retries: 0,
        active: false,
        assertions: [],
      }),
    });

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      id: created.id,
      name: "API edge",
      target: "https://example.com/ready",
      intervalSec: 120,
      assertions: [],
    });
  });

  it("records an initial check when an active monitor is created", async () => {
    const cookie = await setupAdminSession();

    const response = await apiFetch("/api/monitors", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        name: "Initial check",
        kind: "http",
        target: "http://example.com/health",
        intervalSec: 60,
        timeoutMs: 10000,
        retries: 0,
        active: true,
        assertions: [{ id: "status", type: "status", expected: 200 }],
      }),
    });

    expect(response.status).toBe(201);
    const created = (await response.json()) as { id: string };
    const detailResponse = await apiFetch(
      `/api/monitors/${created.id}`,
      cookie,
    );
    expect(detailResponse.status).toBe(200);
    await expect(detailResponse.json()).resolves.toMatchObject({
      monitor: {
        id: created.id,
        lastCheckedAt: expect.any(String),
      },
      heartbeats: [expect.objectContaining({ monitorId: created.id })],
    });
  });

  it("rejects invalid monitor payloads at the API boundary", async () => {
    const cookie = await setupAdminSession();

    const response = await apiFetch("/api/monitors", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        name: "",
        kind: "http",
        intervalSec: 0,
      }),
    });

    expect(response.status).toBe(400);
  });

  it("pauses and resumes monitors through explicit actions", async () => {
    const cookie = await setupAdminSession();

    const createResponse = await apiFetch("/api/monitors", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        name: "Pause target",
        kind: "push",
        target: "",
        intervalSec: 60,
        timeoutMs: 10000,
        retries: 0,
        active: true,
        assertions: [],
      }),
    });
    const created = (await createResponse.json()) as { id: string };

    const pauseResponse = await apiFetch(`/api/monitors/${created.id}/pause`, {
      method: "POST",
      headers: { cookie },
    });
    expect(pauseResponse.status).toBe(200);
    await expect(pauseResponse.json()).resolves.toMatchObject({ active: 0 });

    const resumeResponse = await apiFetch(
      `/api/monitors/${created.id}/resume`,
      {
        method: "POST",
        headers: { cookie },
      },
    );
    expect(resumeResponse.status).toBe(200);
    await expect(resumeResponse.json()).resolves.toMatchObject({ active: 1 });
  });
});

describe("status page API", () => {
  it("dedupes linked monitors and returns public heartbeat history per monitor", async () => {
    const cookie = await setupAdminSession();
    const db = getDrizzle(env.DB);
    const busyMonitorId = crypto.randomUUID();
    const quietMonitorId = crypto.randomUUID();

    await db.insert(schema.monitors).values([
      {
        id: busyMonitorId,
        name: "Busy API",
        kind: "http",
        target: "https://busy.example.com/health",
        intervalSec: 60,
        timeoutMs: 10000,
        retries: 0,
        assertionsJson: "[]",
        pushToken: null,
        active: 1,
        lastStatus: "up",
        lastCheckedAt: "2026-05-01T12:49:00.000Z",
        lastDurationMs: 100,
        lastError: null,
        createdAt: "2026-05-01T12:00:00.000Z",
        updatedAt: "2026-05-01T12:49:00.000Z",
      },
      {
        id: quietMonitorId,
        name: "Quiet API",
        kind: "http",
        target: "https://quiet.example.com/health",
        intervalSec: 60,
        timeoutMs: 10000,
        retries: 0,
        assertionsJson: "[]",
        pushToken: null,
        active: 1,
        lastStatus: "up",
        lastCheckedAt: "2026-05-01T11:00:00.000Z",
        lastDurationMs: 120,
        lastError: null,
        createdAt: "2026-05-01T10:00:00.000Z",
        updatedAt: "2026-05-01T11:00:00.000Z",
      },
    ]);

    for (const heartbeat of [
      ...Array.from({ length: 50 }, (_, index) => ({
        id: crypto.randomUUID(),
        monitorId: busyMonitorId,
        status: "up",
        statusCode: 200,
        durationMs: 100 + index,
        error: null,
        createdAt: new Date(Date.UTC(2026, 4, 1, 12, index, 0)).toISOString(),
        source: "poll",
      })),
      {
        id: crypto.randomUUID(),
        monitorId: quietMonitorId,
        status: "up",
        statusCode: 200,
        durationMs: 120,
        error: null,
        createdAt: "2026-05-01T11:00:00.000Z",
        source: "poll",
      },
    ]) {
      await db.insert(schema.heartbeats).values(heartbeat);
    }

    const createResponse = await apiFetch("/api/status-pages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        slug: "public",
        title: "Public",
        description: null,
        published: true,
        showHistory: true,
        monitorIds: [busyMonitorId, quietMonitorId, quietMonitorId],
      }),
    });

    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      page: { id: string };
      monitorIds: string[];
    };
    expect(created.monitorIds).toEqual([busyMonitorId, quietMonitorId]);

    const publicResponse = await apiFetch("/api/status/public");
    expect(publicResponse.status).toBe(200);
    const publicData = (await publicResponse.json()) as {
      heartbeats: Array<{ monitorId: string }>;
    };

    expect(
      publicData.heartbeats.filter(
        (heartbeat) => heartbeat.monitorId === busyMonitorId,
      ),
    ).toHaveLength(45);
    expect(
      publicData.heartbeats.filter(
        (heartbeat) => heartbeat.monitorId === quietMonitorId,
      ),
    ).toHaveLength(1);
  });
});

describe("notification API", () => {
  it("persists provider config and monitor bindings through the real API", async () => {
    const cookie = await setupAdminSession();
    const monitorId = await seedMonitorWithHeartbeats(0);

    const createResponse = await apiFetch("/api/notifications", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        name: "Ops webhook",
        provider: "webhook",
        url: "https://example.com/hook",
        headers: [{ key: "x-api-key", value: "secret" }],
        monitorIds: [monitorId, monitorId],
      }),
    });

    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toMatchObject({
      name: "Ops webhook",
      provider: "webhook",
      config: {
        url: "https://example.com/hook",
        headers: [{ key: "x-api-key", value: "secret" }],
      },
      monitorIds: [monitorId],
    });
  });

  it("rejects invalid notification URLs at the API boundary", async () => {
    const cookie = await setupAdminSession();

    const response = await apiFetch("/api/notifications", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        name: "Bad webhook",
        provider: "webhook",
        url: "not-a-url",
        headers: [],
        monitorIds: [],
      }),
    });

    expect(response.status).toBe(400);
  });
});
