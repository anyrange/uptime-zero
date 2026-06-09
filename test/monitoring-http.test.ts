import { describe, expect, it, vi } from "vitest";

import type { MonitorAssertion, MonitorRecord } from "@/types";

import { runHttpCheck } from "@/api/lib/monitoring";

describe("monitor runtime assertions", () => {
  it("passes HTTP status, header, and JSON body assertions", async () => {
    const monitor = buildMonitor({
      assertions: [
        { id: "a1", type: "status", expected: 200 },
        {
          id: "a2",
          type: "header",
          header: "content-type",
          operator: "contains",
          value: "application/json",
        },
        {
          id: "a3",
          type: "body",
          source: "json",
          path: "status",
          operator: "eq",
          value: "ok",
        },
      ],
    });

    const result = await runHttpCheck(
      monitor,
      vi.fn(
        async () =>
          new Response(JSON.stringify({ status: "ok" }), {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          }),
      ) as typeof fetch,
    );

    expect(result.status).toBe("up");
    expect(result.error).toBeNull();
  });

  it("fails DNS assertions when the expected record is missing", async () => {
    const monitor = buildMonitor({
      kind: "dns",
      target: "example.com",
      assertions: [
        {
          id: "dns-1",
          type: "record",
          recordType: "A",
          operator: "contains",
          value: "203.0.113.10",
        },
      ],
    });

    const result = await runHttpCheck(
      monitor,
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              Status: 0,
              Answer: [{ type: 1, data: "198.51.100.5" }],
            }),
            {
              status: 200,
              headers: { "content-type": "application/dns-json" },
            },
          ),
      ) as typeof fetch,
    );

    expect(result.status).toBe("down");
    expect(result.error).toBe("A record assertion failed");
  });
});

function buildMonitor(overrides: Partial<MonitorRecord> = {}): MonitorRecord {
  return {
    id: "monitor-1",
    name: "API",
    kind: "http",
    target: "https://example.com/health",
    intervalSec: 60,
    timeoutMs: 10_000,
    retries: 0,
    assertions: [createStatusAssertion()],
    heartbeatMode: "interval",
    heartbeatCron: "0 * * * *",
    heartbeatGraceSec: 300,
    heartbeatTimezone: "UTC",
    notificationGraceSec: 0,
    pushToken: null,
    active: 1,
    lastStatus: "unknown",
    lastCheckedAt: null,
    lastDurationMs: null,
    lastError: null,
    lastDownNotifiedAt: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function createStatusAssertion(): MonitorAssertion {
  return {
    id: "status-default",
    type: "status",
    expected: 200,
  };
}
