import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import type { MonitorStatus } from "@/lib/schemas/monitors";

import { privateKey } from "@/lib/api/keys";
import { permissionMiddleware } from "@/lib/api/middleware";
import * as incidents from "@/modules/incidents/incidents.service";
import * as monitors from "@/modules/monitors/monitors.service";
import { aggregateStatus } from "@/modules/monitors/schedule";
import * as statusPages from "@/modules/status-pages/status-pages.service";

/** The overview page and the sidebar both read this snapshot. */
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([permissionMiddleware("monitor.read")])
  .handler(async () => {
    const [
      allMonitors,
      recentIncidents,
      openIncidentCount,
      heartbeatCounts,
      heartbeats,
      pages,
    ] = await Promise.all([
      monitors.all(),
      incidents.recent(),
      incidents.countOpen(),
      monitors.recentHeartbeatCounts(),
      monitors.recentHeartbeats(),
      statusPages.list(),
    ]);

    const counts: Record<MonitorStatus, number> = {
      up: 0,
      down: 0,
      unknown: 0,
    };

    for (const monitor of allMonitors) counts[monitor.lastStatus] += 1;

    return {
      monitors: allMonitors,
      incidents: recentIncidents,
      openIncidentCount,
      heartbeatCounts,
      heartbeats,
      statusPages: pages,
      counts,
      overallStatus: aggregateStatus(
        allMonitors.map((monitor) => monitor.lastStatus),
      ),
    };
  });

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;

export const DASHBOARD_POLL_INTERVAL_MS = 30_000;

export function dashboardQueryOptions() {
  return queryOptions({
    queryKey: privateKey("dashboard"),
    queryFn: () => getDashboard(),
    refetchInterval: DASHBOARD_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}
