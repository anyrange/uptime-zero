import { describe, expect, it } from "vitest";

import {
  DEFAULT_HEARTBEAT_CRON,
  DEFAULT_HEARTBEAT_GRACE_SEC,
  DEFAULT_HEARTBEAT_TIMEZONE,
} from "@/lib/monitor/config";
import {
  getCronHeartbeatSchedule,
  getNextCronHeartbeatExpectedAt,
} from "@/server/lib/monitoring-cron";

describe("monitoring cron helpers", () => {
  it("falls back to defaults for omitted heartbeat schedule values", () => {
    expect(
      getCronHeartbeatSchedule({
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

  it("uses explicit heartbeat schedule values from the monitor config", () => {
    expect(
      getCronHeartbeatSchedule({
        heartbeatCron: "*/10 * * * *",
        heartbeatGraceSec: 42,
        heartbeatTimezone: "America/New_York",
      }),
    ).toEqual({
      cron: "*/10 * * * *",
      graceSec: 42,
      timezone: "America/New_York",
    });
  });

  it("computes the next cron heartbeat in UTC with the expected timezone-aware baseline", () => {
    expect(
      getNextCronHeartbeatExpectedAt(
        {
          heartbeatCron: "*/15 * * * *",
          heartbeatGraceSec: 300,
          heartbeatTimezone: "UTC",
        },
        Date.parse("2026-06-13T12:07:30.000Z"),
      ),
    ).toBe(Date.parse("2026-06-13T12:15:00.000Z"));
  });

  it("throws when schedule expression is not valid", () => {
    expect(() =>
      getNextCronHeartbeatExpectedAt(
        {
          heartbeatCron: "invalid cron",
          heartbeatGraceSec: 300,
          heartbeatTimezone: "UTC",
        },
        Date.parse("2026-06-13T12:00:00.000Z"),
      ),
    ).toThrow(/CronPattern: invalid configuration format/);
  });
});
