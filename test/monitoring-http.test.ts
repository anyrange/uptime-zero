import { describe, expect, it, vi } from "vitest";

import type { MonitorAssertion, MonitorRecord } from "@/types";

import { runHttpCheck } from "@/server/lib/monitoring";

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
      vi.fn<typeof fetch>(
        async () =>
          new Response(JSON.stringify({ status: "ok" }), {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          }),
      ),
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
      vi.fn<typeof fetch>(
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
      ),
    );

    expect(result.status).toBe("down");
    expect(result.error).toBe("A record assertion failed");
  });

  it("accepts an expected non-success HTTP status", async () => {
    const monitor = buildMonitor({
      assertions: [{ id: "status-404", type: "status", expected: 404 }],
    });

    const result = await runHttpCheck(
      monitor,
      vi.fn<typeof fetch>(async () => new Response(null, { status: 404 })),
    );

    expect(result).toMatchObject({
      status: "up",
      statusCode: 404,
      error: null,
    });
  });

  it("rejects assertion bodies larger than the monitor limit", async () => {
    const monitor = buildMonitor({
      assertions: [
        {
          id: "body",
          type: "body",
          source: "text",
          operator: "contains",
          value: "ok",
        },
      ],
    });

    const result = await runHttpCheck(
      monitor,
      vi.fn<typeof fetch>(
        async () =>
          new Response("ignored", {
            status: 200,
            headers: { "content-length": String(1024 * 1024 + 1) },
          }),
      ),
    );

    expect(result).toMatchObject({
      status: "down",
      error: "Response body exceeded 1048576 bytes",
    });
  });

  it("limits redirect chains", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "/next" },
        }),
    );

    const result = await runHttpCheck(buildMonitor(), fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({
      status: "down",
      error: "Too many redirects (maximum 2)",
    });
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
