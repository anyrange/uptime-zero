import { describe, expect, it } from "vitest";

import type { IncidentListRecord } from "@/types";

import { filterIncidentListRecords } from "@/server/lib/incidents";

const incidents: IncidentListRecord[] = [
  {
    id: "incident-open-new",
    status: "open",
    title: "API outage",
    body: "Primary API is timing out",
    openedAt: "2026-05-02T12:00:00.000Z",
    closedAt: null,
    monitorId: "monitor-api",
    monitorName: "API Gateway",
    monitorKind: "http",
    monitorLastStatus: "down",
  },
  {
    id: "incident-open-old",
    status: "open",
    title: "Worker latency spike",
    body: "Elevated response times on edge worker",
    openedAt: "2026-05-01T12:00:00.000Z",
    closedAt: null,
    monitorId: "monitor-worker",
    monitorName: "Worker",
    monitorKind: "http",
    monitorLastStatus: "down",
  },
  {
    id: "incident-closed-new",
    status: "closed",
    title: "Database recovered",
    body: "Database failover completed",
    openedAt: "2026-05-03T12:00:00.000Z",
    closedAt: "2026-05-03T12:15:00.000Z",
    monitorId: "monitor-db",
    monitorName: "Database",
    monitorKind: "dns",
    monitorLastStatus: "up",
  },
  {
    id: "incident-closed-old",
    status: "closed",
    title: "Cache miss storm",
    body: "Cache node drained unexpectedly",
    openedAt: "2026-04-30T12:00:00.000Z",
    closedAt: "2026-04-30T12:20:00.000Z",
    monitorId: "monitor-cache",
    monitorName: "Cache",
    monitorKind: "http",
    monitorLastStatus: "up",
  },
];

describe("incident list helpers", () => {
  it("sorts open incidents before closed incidents", () => {
    expect(
      filterIncidentListRecords(incidents, { status: "all" }).map(
        (incident) => incident.id,
      ),
    ).toEqual([
      "incident-open-new",
      "incident-open-old",
      "incident-closed-new",
      "incident-closed-old",
    ]);
  });

  it("sorts newest incidents first within each status bucket", () => {
    const ordered = filterIncidentListRecords(incidents, { status: "all" });
    expect(ordered[0]?.openedAt).toBe("2026-05-02T12:00:00.000Z");
    expect(ordered[1]?.openedAt).toBe("2026-05-01T12:00:00.000Z");
    expect(ordered[2]?.openedAt).toBe("2026-05-03T12:00:00.000Z");
    expect(ordered[3]?.openedAt).toBe("2026-04-30T12:00:00.000Z");
  });

  it("filters to open incidents", () => {
    expect(
      filterIncidentListRecords(incidents, { status: "open" }).map(
        (incident) => incident.id,
      ),
    ).toEqual(["incident-open-new", "incident-open-old"]);
  });

  it("filters by monitor id", () => {
    expect(
      filterIncidentListRecords(incidents, {
        status: "all",
        monitorId: "monitor-db",
      }).map((incident) => incident.id),
    ).toEqual(["incident-closed-new"]);
  });

  it("matches query text against monitor name and incident text", () => {
    expect(
      filterIncidentListRecords(incidents, {
        status: "all",
        query: "gateway",
      }).map((incident) => incident.id),
    ).toEqual(["incident-open-new"]);

    expect(
      filterIncidentListRecords(incidents, {
        status: "all",
        query: "failover",
      }).map((incident) => incident.id),
    ).toEqual(["incident-closed-new"]);
  });
});
