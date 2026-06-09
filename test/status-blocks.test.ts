import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HeartbeatRecord, IncidentRecord, MonitorStatus } from "@/types";

import {
  buildDailyStatusBarData,
  buildHourlyStatusBarData,
} from "@/lib/status-blocks";

const monitorId = "monitor-1";

function heartbeat(
  id: string,
  status: MonitorStatus,
  createdAt: Date,
): HeartbeatRecord {
  return {
    id,
    monitorId,
    status,
    statusCode: status === "up" ? 200 : null,
    durationMs: status === "up" ? 123 : null,
    error: status === "down" ? "Request failed" : null,
    createdAt: createdAt.toISOString(),
    source: "poll",
  };
}

function incident(
  id: string,
  openedAt: Date,
  closedAt: Date | null,
): IncidentRecord {
  return {
    id,
    monitorId,
    title: `Incident ${id}`,
    status: closedAt ? "closed" : "open",
    body: null,
    pinned: 0,
    openedAt: openedAt.toISOString(),
    closedAt: closedAt ? closedAt.toISOString() : null,
  };
}

describe("status block history builders", () => {
  const now = new Date("2026-05-07T12:30:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("groups multiple heartbeats into one hourly bucket", () => {
    const data = buildHourlyStatusBarData(
      [
        heartbeat("hb-1", "up", new Date(now.getTime() - 10 * 60 * 1000)),
        heartbeat("hb-2", "up", new Date(now.getTime() - 20 * 60 * 1000)),
      ],
      [],
      2,
    );

    expect(data).toHaveLength(2);
    expect(data.at(-1)?.bar).toEqual([{ status: "success", height: 100 }]);
    expect(data.at(-1)?.card).toEqual([
      { status: "success", value: "2 successful checks" },
    ]);
  });

  it("returns exactly 45 daily bars oldest-to-newest", () => {
    const data = buildDailyStatusBarData(
      [heartbeat("hb-1", "up", now)],
      [],
      45,
    );

    expect(data).toHaveLength(45);
    expect(new Date(data[0].day).getTime()).toBeLessThan(
      new Date(data.at(-1)!.day).getTime(),
    );
    expect(data.at(-1)?.bar).toEqual([{ status: "success", height: 100 }]);
  });

  it("builds proportional stacked segments for mixed statuses", () => {
    const data = buildHourlyStatusBarData(
      [
        heartbeat("hb-1", "up", now),
        heartbeat("hb-2", "up", now),
        heartbeat("hb-3", "down", now),
        heartbeat("hb-4", "unknown", now),
      ],
      [],
      1,
    );

    expect(data[0].bar).toEqual([
      { status: "success", height: 50 },
      { status: "error", height: 25 },
      { status: "degraded", height: 25 },
    ]);
    expect(data[0].card).toEqual([
      { status: "success", value: "2 successful checks" },
      { status: "error", value: "1 failed check" },
      { status: "degraded", value: "1 unknown check" },
    ]);
  });

  it("renders empty public days as empty bars", () => {
    const data = buildDailyStatusBarData([], [], 45);

    expect(data).toHaveLength(45);
    expect(data.every((item) => item.bar[0]?.status === "empty")).toBe(true);
    expect(data.every((item) => item.card[0]?.value === "No data")).toBe(true);
  });

  it("attaches incidents to overlapping hour and day buckets", () => {
    const outage = incident(
      "incident-123",
      new Date(now.getTime() - 30 * 60 * 1000),
      new Date(now.getTime() + 30 * 60 * 1000),
    );

    const hourly = buildHourlyStatusBarData([], [outage], 1);
    const daily = buildDailyStatusBarData([], [outage], 1);

    expect(hourly[0].events).toMatchObject([
      { id: 123, name: "Incident incident-123", type: "incident" },
    ]);
    expect(daily[0].events).toMatchObject([
      { id: 123, name: "Incident incident-123", type: "incident" },
    ]);
  });
});
