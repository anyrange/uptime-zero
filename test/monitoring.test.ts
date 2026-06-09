import { describe, expect, it } from "vitest";

import { parseDateMs } from "@/server/lib/dates";
import {
  compareJsonValue,
  computeAggregateStatus,
  getMonitorNextDueAt,
  isCronHeartbeatOverdue,
  isPushMonitorOverdue,
  readJsonPath,
} from "@/server/lib/monitoring";

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
});
