import { describe, expect, it } from "vitest";

import {
  clampMonitorLogsPage,
  getMonitorLogsPageRange,
  MONITOR_LOGS_PAGE_SIZE,
} from "@/lib/monitor/logs";

import {
  apiFetch,
  seedMonitorWithHeartbeats,
  setupAdminSession,
} from "./api-test-utils";

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

describe("monitor logs API", () => {
  it("requires authentication for private monitor log routes", async () => {
    const response = await apiFetch("/api/monitors/missing/logs?page=1");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "Authentication required",
    });
  });

  it("returns a real paginated heartbeat page from D1", async () => {
    const cookie = await setupAdminSession();
    const monitorId = await seedMonitorWithHeartbeats(33);

    const response = await apiFetch(
      `/api/monitors/${monitorId}/logs?page=2`,
      cookie,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      page: 2,
      pageSize: MONITOR_LOGS_PAGE_SIZE,
      total: 33,
      totalPages: 2,
      hasPreviousPage: true,
      hasNextPage: false,
      heartbeats: expect.arrayContaining([
        expect.objectContaining({ monitorId }),
      ]),
    });
  });

  it("defaults invalid page values to the first page", async () => {
    const cookie = await setupAdminSession();
    const monitorId = await seedMonitorWithHeartbeats(1);

    const response = await apiFetch(
      `/api/monitors/${monitorId}/logs?page=wat`,
      cookie,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      page: 1,
      total: 1,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
  });

  it("returns 404 for an unknown monitor", async () => {
    const cookie = await setupAdminSession();

    const response = await apiFetch(
      "/api/monitors/missing/logs?page=1",
      cookie,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "Monitor not found",
    });
  });
});
