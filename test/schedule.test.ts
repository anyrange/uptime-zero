import { describe, expect, it } from "vitest";

import {
  DEFAULT_HEARTBEAT_CRON,
  DEFAULT_HEARTBEAT_GRACE_SEC,
  DEFAULT_HEARTBEAT_TIMEZONE,
} from "@/lib/schemas/monitor-config";
import {
  aggregateStatus,
  cronHeartbeatSchedule,
  isDue,
  nextCronRunAt,
  nextDueAt,
} from "@/modules/monitors/schedule";

const schedulable = (
  overrides: Partial<Parameters<typeof nextDueAt>[0]> = {},
): Parameters<typeof nextDueAt>[0] => ({
  kind: "http",
  retryAt: null,
  lastCheckedAt: "2026-05-01T12:00:05.000Z",
  intervalSec: 60,
  timeoutMs: 5000,
  heartbeatMode: "interval",
  heartbeatCron: null,
  heartbeatGraceSec: null,
  heartbeatTimezone: null,
  createdAt: "2026-05-01T12:00:00.000Z",
  ...overrides,
});

describe("monitor schedule", () => {
  it("lets down take precedence over up over unknown", () => {
    expect(aggregateStatus(["up", "unknown"])).toBe("up");
    expect(aggregateStatus(["unknown", "down"])).toBe("down");
    expect(aggregateStatus(["unknown"])).toBe("unknown");
    expect(aggregateStatus([])).toBe("unknown");
  });

  it("polls one interval after the last check, or after creation", () => {
    expect(nextDueAt(schedulable())).toBe(
      Date.parse("2026-05-01T12:01:05.000Z"),
    );
    expect(nextDueAt(schedulable({ lastCheckedAt: null }))).toBe(
      Date.parse("2026-05-01T12:01:00.000Z"),
    );
  });

  it("waits for the back-off time after a failed check", () => {
    const retryAt = Date.parse("2026-05-01T12:00:35.000Z");

    expect(nextDueAt(schedulable({ retryAt }))).toBe(retryAt);
  });

  it("marks interval heartbeats overdue after interval plus timeout", () => {
    const monitor = schedulable({ kind: "push" });

    expect(nextDueAt(monitor)).toBe(Date.parse("2026-05-01T12:01:10.000Z"));
    expect(isDue(monitor, Date.parse("2026-05-01T12:01:09.999Z"))).toBe(false);
    expect(isDue(monitor, Date.parse("2026-05-01T12:01:10.000Z"))).toBe(true);
  });

  it("marks cron heartbeats overdue after the next run plus grace", () => {
    const monitor = schedulable({
      kind: "push",
      lastCheckedAt: "2026-05-01T12:05:00.000Z",
      heartbeatMode: "cron",
      heartbeatCron: "0 * * * *",
      heartbeatGraceSec: 60,
      heartbeatTimezone: "UTC",
    });

    expect(nextDueAt(monitor)).toBe(Date.parse("2026-05-01T13:01:00.000Z"));
    expect(isDue(monitor, Date.parse("2026-05-01T13:00:59.000Z"))).toBe(false);
    expect(isDue(monitor, Date.parse("2026-05-01T13:01:00.000Z"))).toBe(true);
  });

  it("falls back to default cron heartbeat settings", () => {
    expect(
      cronHeartbeatSchedule({
        heartbeatCron: null,
        heartbeatGraceSec: null,
        heartbeatTimezone: null,
      }),
    ).toEqual({
      cron: DEFAULT_HEARTBEAT_CRON,
      graceSec: DEFAULT_HEARTBEAT_GRACE_SEC,
      timezone: DEFAULT_HEARTBEAT_TIMEZONE,
    });
  });

  it("computes the next cron run in the monitor's time zone", () => {
    const schedule = {
      heartbeatCron: "0 9 * * *",
      heartbeatGraceSec: 300,
      heartbeatTimezone: "America/New_York",
    };

    // 09:00 in New York is 13:00 UTC during daylight saving time.
    expect(
      nextCronRunAt(schedule, Date.parse("2026-06-13T12:07:30.000Z")),
    ).toBe(Date.parse("2026-06-13T13:00:00.000Z"));
  });

  it("throws on an invalid cron expression", () => {
    expect(() =>
      nextCronRunAt(
        {
          heartbeatCron: "invalid cron",
          heartbeatGraceSec: 300,
          heartbeatTimezone: "UTC",
        },
        Date.parse("2026-06-13T12:00:00.000Z"),
      ),
    ).toThrow();
  });
});
