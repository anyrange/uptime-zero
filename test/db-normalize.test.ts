import { describe, expect, it } from "vitest";

import {
  mapHeartbeatRecord,
  mapIncidentListRecord,
  mapIncidentRecord,
  mapMonitorRecord,
  mapNotificationDestinationRecord,
  mapStatusPageRecord,
  normalizeHeartbeatSource,
  normalizeIncidentStatus,
  normalizeMonitorKind,
  normalizeMonitorSslStatus,
  normalizeMonitorStatus,
  normalizeNotificationProvider,
} from "@/api/db/normalize";

const now = "2026-05-01T00:00:00.000Z";

describe("database record normalization", () => {
  it("normalizes monitor rows and assertions", () => {
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
      pushToken: null,
      active: 1,
      lastStatus: "stale",
      lastCheckedAt: null,
      lastDurationMs: null,
      lastError: null,
      lastCertValidTo: null,
      lastCertDaysRemaining: null,
      lastCertHostname: null,
      lastSslStatus: "self-signed",
      createdAt: now,
      updatedAt: now,
    });

    expect(record.kind).toBe("http");
    expect(record.lastStatus).toBe("unknown");
    expect(record.lastSslStatus).toBeNull();
    expect(record.assertions).toEqual([
      { id: "status-200", type: "status", expected: 200 },
    ]);
  });

  it("normalizes heartbeat, incident, status page, and incident list rows", () => {
    expect(
      mapHeartbeatRecord({
        id: "heartbeat-1",
        monitorId: "monitor-api",
        status: "pending",
        statusCode: null,
        durationMs: null,
        error: null,
        certDaysRemaining: null,
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

  it("normalizes notification providers before parsing config", () => {
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
    expect(normalizeMonitorKind("dns")).toBe("dns");
    expect(normalizeMonitorKind("tcp")).toBe("http");
    expect(normalizeMonitorStatus("down")).toBe("down");
    expect(normalizeMonitorStatus("pending")).toBe("unknown");
    expect(normalizeMonitorSslStatus("expiring")).toBe("expiring");
    expect(normalizeMonitorSslStatus("self-signed")).toBeNull();
    expect(normalizeMonitorSslStatus(null)).toBeNull();
    expect(normalizeHeartbeatSource("push")).toBe("push");
    expect(normalizeHeartbeatSource("manual")).toBe("system");
    expect(normalizeIncidentStatus("open")).toBe("open");
    expect(normalizeIncidentStatus("pending")).toBe("closed");
    expect(normalizeNotificationProvider("telegram")).toBe("telegram");
    expect(normalizeNotificationProvider("email")).toBe("webhook");
  });
});
