import { describe, expect, it } from "vitest";

import type { MonitorRecord } from "@/types";

import { parseDateMs } from "@/api/lib/dates";
import {
  compareJsonValue,
  computeAggregateStatus,
  getCertDaysRemaining,
  getMonitorSslDetails,
  getMonitorNextDueAt,
  getSslStatus,
  isCronHeartbeatOverdue,
  isPushMonitorOverdue,
  mergeHttpAndSslResult,
  parseCertValidTo,
  readJsonPath,
} from "@/api/lib/monitoring";

describe("monitoring helpers", () => {
  it("computes aggregate status with down taking precedence", () => {
    expect(computeAggregateStatus(["up", "unknown"])).toBe("up");
    expect(computeAggregateStatus(["unknown", "down"])).toBe("down");
    expect(computeAggregateStatus(["unknown"])).toBe("unknown");
  });

  it("reads nested JSON paths", () => {
    const payload = {
      data: {
        items: [{ status: "warm" }, { status: "ready" }],
      },
    };
    expect(readJsonPath(payload, "data.items[1].status")).toBe("ready");
  });

  it("compares JSON values across operators", () => {
    expect(compareJsonValue(200, "eq", "200")).toBe(true);
    expect(compareJsonValue(["a", "b"], "includes", "b")).toBe(true);
    expect(compareJsonValue(10, "gt", "5")).toBe(true);
    expect(compareJsonValue("prod-edge", "includes", "edge")).toBe(true);
  });

  it("marks push monitors overdue after interval plus timeout", () => {
    const now = parseDateMs("2026-05-01T12:01:20.000Z");
    expect(
      isPushMonitorOverdue(
        "2026-05-01T12:00:00.000Z",
        now,
        60,
        1000,
        "2026-05-01T12:00:00.000Z",
      ).due,
    ).toBe(true);
    expect(
      isPushMonitorOverdue(
        "2026-05-01T12:01:05.000Z",
        now,
        60,
        1000,
        "2026-05-01T12:00:00.000Z",
      ).due,
    ).toBe(false);
  });

  it("computes the next due timestamp for poll and push monitors", () => {
    expect(
      getMonitorNextDueAt({
        kind: "http",
        lastCheckedAt: "2026-05-01T12:00:05.000Z",
        intervalSec: 60,
        timeoutMs: 5000,
        heartbeatMode: "interval",
        heartbeatCron: null,
        heartbeatGraceSec: null,
        heartbeatTimezone: null,
        createdAt: "2026-05-01T12:00:00.000Z",
      }),
    ).toBe(parseDateMs("2026-05-01T12:01:05.000Z"));

    expect(
      getMonitorNextDueAt({
        kind: "push",
        lastCheckedAt: "2026-05-01T12:00:05.000Z",
        intervalSec: 60,
        timeoutMs: 5000,
        heartbeatMode: "interval",
        heartbeatCron: null,
        heartbeatGraceSec: null,
        heartbeatTimezone: null,
        createdAt: "2026-05-01T12:00:00.000Z",
      }),
    ).toBe(parseDateMs("2026-05-01T12:01:10.000Z"));
  });

  it("computes cron heartbeat due timestamps from the configured schedule and grace", () => {
    const monitor = {
      kind: "push" as const,
      lastCheckedAt: "2026-05-01T12:05:00.000Z",
      intervalSec: 60,
      timeoutMs: 5000,
      heartbeatMode: "cron" as const,
      heartbeatCron: "0 * * * *",
      heartbeatGraceSec: 60,
      heartbeatTimezone: "UTC",
      createdAt: "2026-05-01T12:00:00.000Z",
    };

    expect(getMonitorNextDueAt(monitor)).toBe(
      parseDateMs("2026-05-01T13:01:00.000Z"),
    );
    expect(
      isCronHeartbeatOverdue(monitor, parseDateMs("2026-05-01T13:00:59.000Z"))
        .due,
    ).toBe(false);
    expect(
      isCronHeartbeatOverdue(monitor, parseDateMs("2026-05-01T13:01:00.000Z"))
        .due,
    ).toBe(true);
  });

  it("parses certificate validity dates and computes remaining days", () => {
    const validTo = parseCertValidTo("May 15 23:59:59 2026 GMT");
    expect(validTo).toBe("2026-05-15T23:59:59.000Z");
    expect(
      getCertDaysRemaining(validTo!, parseDateMs("2026-05-01T00:00:00.000Z")),
    ).toBe(15);
  });

  it("derives SSL status from certificate dates", () => {
    expect(
      getSslStatus(
        "2026-05-20T00:00:00.000Z",
        parseDateMs("2026-05-01T00:00:00.000Z"),
      ),
    ).toBe("valid");
    expect(
      getSslStatus(
        "2026-05-10T00:00:00.000Z",
        parseDateMs("2026-05-01T00:00:00.000Z"),
      ),
    ).toBe("expiring");
    expect(
      getSslStatus(
        "2026-04-30T00:00:00.000Z",
        parseDateMs("2026-05-01T00:00:00.000Z"),
      ),
    ).toBe("expired");
    expect(getSslStatus(null, parseDateMs("2026-05-01T00:00:00.000Z"))).toBe(
      "unavailable",
    );
  });

  it("keeps HTTP failures as the final result even with valid SSL metadata", () => {
    const result = mergeHttpAndSslResult(
      {
        status: "down",
        statusCode: 500,
        durationMs: 120,
        error: "HTTP 500",
      },
      {
        hostname: "example.com",
        certValidTo: "2026-06-01T00:00:00.000Z",
        certDaysRemaining: 31,
        sslStatus: "valid",
      },
    );

    expect(result.status).toBe("down");
    expect(result.error).toBe("HTTP 500");
    expect(result.certDaysRemaining).toBe(31);
  });

  it("keeps healthy HTTPS checks up when the certificate is comfortably valid", () => {
    const result = mergeHttpAndSslResult(
      {
        status: "up",
        statusCode: 200,
        durationMs: 120,
        error: null,
      },
      {
        hostname: "example.com",
        certValidTo: "2026-06-01T00:00:00.000Z",
        certDaysRemaining: 31,
        sslStatus: "valid",
      },
    );

    expect(result.status).toBe("up");
    expect(result.error).toBeNull();
  });

  it("keeps healthy HTTPS checks up when the certificate is only inside the warning window", () => {
    const result = mergeHttpAndSslResult(
      {
        status: "up",
        statusCode: 200,
        durationMs: 120,
        error: null,
      },
      {
        hostname: "example.com",
        certValidTo: "2026-05-10T00:00:00.000Z",
        certDaysRemaining: 9,
        sslStatus: "expiring",
      },
      { sslExpiryFailDays: 0 },
    );

    expect(result.status).toBe("up");
    expect(result.error).toBeNull();
  });

  it("marks healthy HTTPS checks down when the certificate is inside the failure window", () => {
    const result = mergeHttpAndSslResult(
      {
        status: "up",
        statusCode: 200,
        durationMs: 120,
        error: null,
      },
      {
        hostname: "example.com",
        certValidTo: "2026-05-10T00:00:00.000Z",
        certDaysRemaining: 9,
        sslStatus: "expiring",
      },
      { sslExpiryFailDays: 10 },
    );

    expect(result.status).toBe("down");
    expect(result.error).toBe("SSL certificate expires in 9 days");
  });

  it("marks healthy HTTPS checks down when the certificate is expired", () => {
    const result = mergeHttpAndSslResult(
      {
        status: "up",
        statusCode: 200,
        durationMs: 120,
        error: null,
      },
      {
        hostname: "example.com",
        certValidTo: "2026-04-30T00:00:00.000Z",
        certDaysRemaining: -1,
        sslStatus: "expired",
      },
    );

    expect(result.status).toBe("down");
    expect(result.error).toBe("SSL certificate has expired");
  });

  it("keeps healthy HTTPS checks up when SSL metadata is unavailable", () => {
    const result = mergeHttpAndSslResult(
      {
        status: "up",
        statusCode: 200,
        durationMs: 120,
        error: null,
      },
      {
        hostname: "example.com",
        certValidTo: null,
        certDaysRemaining: null,
        sslStatus: "unavailable",
      },
    );

    expect(result.status).toBe("up");
    expect(result.error).toBeNull();
  });

  it("builds SSL card details for HTTPS monitors and omits them for others", () => {
    const httpsMonitor = buildMonitor({
      target: "https://status.example.com/health",
      lastCertHostname: "status.example.com",
      lastCertValidTo: "2026-06-01T08:30:00.000Z",
      lastCertDaysRemaining: 28,
      lastSslStatus: "valid",
    });
    const httpMonitor = buildMonitor({
      target: "http://status.example.com/health",
    });

    expect(getMonitorSslDetails(httpsMonitor)).toMatchObject({
      hostname: "status.example.com",
      remainingLabel: "28 days left",
      sslStatus: "valid",
    });
    expect(getMonitorSslDetails(httpMonitor)).toBeNull();
  });

  it("renders unavailable SSL state without placeholder chrome", () => {
    const monitor = buildMonitor({
      target: "https://status.example.com/health",
      lastCertHostname: null,
      lastCertValidTo: null,
      lastCertDaysRemaining: null,
      lastSslStatus: "unavailable",
    });

    expect(getMonitorSslDetails(monitor)).toEqual({
      hostname: "status.example.com",
      validUntilLabel: "Unavailable",
      remainingLabel: null,
      sslStatus: "unavailable",
    });
  });
});

function buildMonitor(overrides: Partial<MonitorRecord> = {}): MonitorRecord {
  return {
    id: "monitor-1",
    name: "API",
    kind: "http",
    target: "https://example.com",
    intervalSec: 60,
    timeoutMs: 10_000,
    retries: 0,
    assertions: [],
    sslExpiryWarnDays: 14,
    sslExpiryFailDays: 0,
    heartbeatMode: "interval",
    heartbeatCron: "0 * * * *",
    heartbeatGraceSec: 300,
    heartbeatTimezone: "UTC",
    pushToken: null,
    active: 1,
    lastStatus: "unknown",
    lastCheckedAt: null,
    lastDurationMs: null,
    lastError: null,
    lastCertValidTo: null,
    lastCertDaysRemaining: null,
    lastCertHostname: null,
    lastSslStatus: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}
