import { isNotFound } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import {
  clampMonitorLogsPage,
  getMonitorLogsPageRange,
  MONITOR_LOGS_PAGE_SIZE,
} from "@/lib/monitor-logs";
import * as repo from "@/modules/monitors/monitors.repository";
import * as monitors from "@/modules/monitors/monitors.service";

import { seedMonitor } from "./support";

describe("monitor log pagination helpers", () => {
  it("clamps page numbers to the nearest available page", () => {
    expect(clampMonitorLogsPage(3, 0)).toBe(1);
    expect(clampMonitorLogsPage(0, 4)).toBe(1);
    expect(clampMonitorLogsPage(9, 4)).toBe(4);
    expect(clampMonitorLogsPage(2, 4)).toBe(2);
  });

  it("computes the rendered results summary range", () => {
    expect(
      getMonitorLogsPageRange({
        page: 2,
        pageSize: MONITOR_LOGS_PAGE_SIZE,
        total: 33,
        resultCount: 8,
      }),
    ).toEqual({
      start: 26,
      end: 33,
    });
  });

  it("returns null when there are no checks to summarize", () => {
    expect(
      getMonitorLogsPageRange({
        page: 1,
        pageSize: MONITOR_LOGS_PAGE_SIZE,
        total: 0,
        resultCount: 0,
      }),
    ).toBeNull();
  });
});

describe("monitor log pages", () => {
  it("pages heartbeats newest first and clamps the page", async () => {
    const monitor = await seedMonitor();

    const createdAt = (minute: number) =>
      new Date(Date.UTC(2026, 4, 1, 12, minute)).toISOString();

    // Each recorded check bumps the revision it must run against.
    for (let minute = 0; minute < 33; minute += 1) {
      await repo.recordCheck(
        { ...monitor, revision: minute },
        { status: "up", statusCode: 200, durationMs: 10, error: null },
        "poll",
        createdAt(minute),
      );
    }

    const last = await monitors.logs(monitor.id, 9);

    expect(last).toMatchObject({
      page: 2,
      pageSize: MONITOR_LOGS_PAGE_SIZE,
      total: 33,
      totalPages: 2,
      hasPreviousPage: true,
      hasNextPage: false,
    });
    expect(last.heartbeats).toHaveLength(33 - MONITOR_LOGS_PAGE_SIZE);
    expect(last.heartbeats[0]?.createdAt).toBe(
      createdAt(32 - MONITOR_LOGS_PAGE_SIZE),
    );

    await expect(monitors.logs("missing", 1)).rejects.toSatisfy(isNotFound);
  });
});
