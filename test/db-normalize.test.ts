import { describe, expect, it } from "vitest";

import {
  mapIncidentListRecord,
  mapIncidentRecord,
} from "@/server/db/models/incident";
import {
  mapHeartbeatRecord,
  mapMonitorRecord,
} from "@/server/db/models/monitor";
import { mapNotificationDestinationRecord } from "@/server/db/models/notification";
import { mapStatusPageRecord } from "@/server/db/models/status-page";
import {
  readHeartbeatSource,
  readIncidentStatus,
  readMonitorKind,
  readMonitorStatus,
  readNotificationProvider,
} from "@/server/db/values";

const now = "2026-05-01T00:00:00.000Z";

describe("database record mapping", () => {
  it("maps monitor rows and parses assertions", () => {
    const record = mapMonitorRecord({
      id: "monitor-api",
      name: "API",
      kind: "tcp",
      target: "https://example.com",
      intervalSec: 60,
      timeoutMs: 10000,
      retries: 1,
      assertionsJson: JSON.stringify([
        { id: "status-200", type: "status", expected: 200 },
        { id: "invalid", type: "header", operator: "missing" },
      ]),
      heartbeatMode: "later",
      heartbeatCron: null,
      heartbeatGraceSec: null,
      heartbeatTimezone: null,
      notificationGraceSec: 0,
      pushToken: null,
      active: 1,
      lastStatus: "stale",
      lastCheckedAt: null,
      lastDurationMs: null,
      lastError: null,
      lastDownNotifiedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    expect(record.kind).toBe("http");
    expect(record.lastStatus).toBe("unknown");
    expect(record.assertions).toEqual([
      { id: "status-200", type: "status", expected: 200 },
    ]);
  });

  it("maps heartbeat, incident, status page, and incident list rows", () => {
    expect(
      mapHeartbeatRecord({
        id: "heartbeat-1",
        monitorId: "monitor-api",
        status: "pending",
        statusCode: null,
        durationMs: null,
        error: null,
        createdAt: now,
        source: "manual",
      }),
    ).toMatchObject({ status: "unknown", source: "system" });

    expect(
      mapIncidentRecord({
        id: "incident-1",
        monitorId: "monitor-api",
        title: "Outage",
        status: "pending",
        body: null,
        pinned: 0,
        openedAt: now,
        closedAt: null,
      }),
    ).toMatchObject({ status: "closed" });

    expect(
      mapIncidentListRecord({
        id: "incident-list-1",
        status: "pending",
        title: "Outage",
        body: null,
        openedAt: now,
        closedAt: null,
        monitorId: "monitor-api",
        monitorName: "API",
        monitorKind: "tcp",
        monitorLastStatus: "stale",
      }),
    ).toMatchObject({
      status: "closed",
      monitorKind: "http",
      monitorLastStatus: "unknown",
    });

    expect(
      mapStatusPageRecord({
        id: "status-page-1",
        slug: "status",
        title: "Status",
        description: null,
        published: 1,
        showHistory: 1,
        createdAt: now,
        updatedAt: now,
      }),
    ).toMatchObject({ slug: "status" });
  });

  it("reads notification providers before parsing config", () => {
    const record = mapNotificationDestinationRecord({
      id: "destination-1",
      name: "Fallback webhook",
      provider: "email",
      configJson: JSON.stringify({
        url: "https://example.com/hook",
        headers: [{ key: "x-api-key", value: "secret" }],
      }),
      createdAt: now,
      updatedAt: now,
    });

    expect(record.provider).toBe("webhook");
    expect(record.config).toEqual({
      url: "https://example.com/hook",
      headers: [{ key: "x-api-key", value: "secret" }],
    });
  });

  it("keeps valid enum values and falls back invalid values", () => {
    expect(readMonitorKind("dns")).toBe("dns");
    expect(readMonitorKind("tcp")).toBe("http");
    expect(readMonitorStatus("down")).toBe("down");
    expect(readMonitorStatus("pending")).toBe("unknown");
    expect(readHeartbeatSource("push")).toBe("push");
    expect(readHeartbeatSource("manual")).toBe("system");
    expect(readIncidentStatus("open")).toBe("open");
    expect(readIncidentStatus("pending")).toBe("closed");
    expect(readNotificationProvider("telegram")).toBe("telegram");
    expect(readNotificationProvider("email")).toBe("webhook");
  });
});
