import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  HeartbeatRecord,
  IncidentRecord,
  MonitorKind,
  MonitorRecord,
  MonitorStatus,
  PublicStatusPageData,
  StatusPageRecord,
} from "@/types";

import { buildPublicStatusPageView } from "@/lib/public-status-page-view";

const now = new Date("2026-05-07T12:30:00.000Z");

describe("public status page view model", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adapts public status page data into render-ready monitor groups", () => {
    const data = publicStatusPageData({
      monitors: [
        monitor("http-1", "API", "http", "up"),
        monitor("dns-1", "DNS", "dns", "unknown"),
        monitor("push-1", "Worker cron", "push", "down"),
      ],
      heartbeats: [
        heartbeat("hb-1", "http-1", "up"),
        heartbeat("hb-2", "push-1", "down"),
      ],
      status: "down",
    });

    const view = buildPublicStatusPageView(data);

    expect(view).toMatchObject({
      title: "Status",
      description: "Public status",
      overallStatus: "error",
      showHistory: true,
    });
    expect(view.monitorGroups.map((group) => group.title)).toEqual([
      "HTTP monitors",
      "DNS monitors",
      "Heartbeat monitors",
    ]);
    expect(view.monitorGroups.map((group) => group.status)).toEqual([
      "success",
      "degraded",
      "error",
    ]);
    expect(view.monitors.find((item) => item.id === "push-1")?.meta).toBe(
      "Heartbeat monitor",
    );
    expect(view.monitors.find((item) => item.id === "http-1")?.uptime).toBe(
      "100% uptime",
    );
  });

  it("builds incident views and status reports with affected monitor names", () => {
    const data = publicStatusPageData({
      monitors: [monitor("http-1", "API", "http", "down")],
      incidents: [
        incident("incident-1", "http-1", "API is down", "Origin timeout", null),
        incident(
          "incident-2",
          "missing-monitor",
          "Unknown dependency recovered",
          null,
          "2026-05-07T11:00:00.000Z",
        ),
      ],
    });

    const view = buildPublicStatusPageView(data);

    expect(view.incidents[0]).toMatchObject({
      badge: "Open",
      status: "error",
      monitorName: "API",
    });
    expect(view.incidents[0].updates).toMatchObject([
      {
        message: "Origin timeout",
        status: "investigating",
      },
    ]);
    expect(view.incidents[1]).toMatchObject({
      badge: "Resolved",
      status: "success",
      monitorName: "Monitor",
    });
    expect(view.incidents[1].updates).toMatchObject([
      {
        message: "Issue resolved and monitor returned to normal operation.",
        status: "resolved",
      },
      {
        message: "Incident opened.",
        status: "investigating",
      },
    ]);
    expect(view.statusReports).toMatchObject([
      {
        id: 1,
        title: "API is down",
        affected: ["API"],
      },
      {
        id: 2,
        title: "Unknown dependency recovered",
        affected: ["Monitor"],
      },
    ]);
  });

  it("uses page, monitor, and incident timestamps for refreshed time", () => {
    const data = publicStatusPageData({
      page: {
        updatedAt: "2026-05-01T00:00:00.000Z",
        showHistory: 0,
      },
      monitors: [
        monitor("http-1", "API", "http", "up", {
          updatedAt: "2026-05-02T00:00:00.000Z",
        }),
      ],
      incidents: [
        incident(
          "incident-1",
          "http-1",
          "API is down",
          null,
          null,
          "2026-05-03T00:00:00.000Z",
        ),
      ],
    });

    const view = buildPublicStatusPageView(data);

    expect(view.showHistory).toBe(false);
    expect(view.updatedAt.toISOString()).toBe("2026-05-03T00:00:00.000Z");
  });
});

function publicStatusPageData({
  page = {},
  monitors = [],
  incidents = [],
  heartbeats = [],
  status = "up",
}: {
  page?: Partial<StatusPageRecord>;
  monitors?: MonitorRecord[];
  incidents?: IncidentRecord[];
  heartbeats?: HeartbeatRecord[];
  status?: MonitorStatus;
}): PublicStatusPageData {
  return {
    page: {
      id: "page-1",
      slug: "status",
      title: "Status",
      description: "Public status",
      published: 1,
      showHistory: 1,
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
      ...page,
    },
    monitors,
    incidents,
    heartbeats,
    status,
  };
}

function monitor(
  id: string,
  name: string,
  kind: MonitorKind,
  lastStatus: MonitorStatus,
  overrides: Partial<MonitorRecord> = {},
): MonitorRecord {
  return {
    id,
    name,
    kind,
    target: kind === "push" ? "" : `https://${id}.example.com`,
    intervalSec: 60,
    timeoutMs: 10_000,
    retries: 0,
    assertions: [],
    heartbeatMode: "interval",
    heartbeatCron: "0 * * * *",
    heartbeatGraceSec: 300,
    heartbeatTimezone: "UTC",
    notificationGraceSec: 0,
    pushToken: kind === "push" ? `token-${id}` : null,
    active: 1,
    lastStatus,
    lastCheckedAt: null,
    lastDurationMs: null,
    lastError: null,
    lastDownNotifiedAt: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function heartbeat(
  id: string,
  monitorId: string,
  status: MonitorStatus,
): HeartbeatRecord {
  return {
    id,
    monitorId,
    status,
    statusCode: status === "up" ? 200 : null,
    durationMs: status === "up" ? 100 : null,
    error: status === "down" ? "Request failed" : null,
    createdAt: now.toISOString(),
    source: "poll",
  };
}

function incident(
  id: string,
  monitorId: string,
  title: string,
  body: string | null,
  closedAt: string | null,
  openedAt = "2026-05-07T10:00:00.000Z",
): IncidentRecord {
  return {
    id,
    monitorId,
    title,
    status: closedAt ? "closed" : "open",
    body,
    pinned: 0,
    openedAt,
    closedAt,
  };
}
