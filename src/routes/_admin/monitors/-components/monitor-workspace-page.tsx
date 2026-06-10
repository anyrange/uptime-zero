import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";

import type { MonitorDetailData, MonitorRecord } from "@/types";

import { Error } from "@/components/error";
import { AppPage } from "@/components/page";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { m } from "@/paraglide/messages.js";

import { MonitorDetailSkeleton } from "../-components/monitors-skeleton";

export function MonitorWorkspacePage({
  detail,
  currentTab,
  children,
}: {
  detail: UseQueryResult<MonitorDetailData, Error>;
  currentTab: "overview" | "logs" | "incidents" | "settings";
  children: (data: MonitorDetailData) => ReactNode;
}) {
  if (detail.status === "pending") {
    return <MonitorDetailSkeleton />;
  }
  if (detail.status === "error") {
    return <Error message={detail.error.message} />;
  }

  const { monitor } = detail.data;

  return (
    <AppPage title={monitor.name}>
      <div className="grid gap-4">
        <div className="flex flex-col gap-8 py-2">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{monitor.kind.toUpperCase()}</Badge>
              {monitor.active === 1 ? (
                <Badge variant="success">{m.common_active()}</Badge>
              ) : (
                <Badge variant="outline">{m.common_paused()}</Badge>
              )}
              <StatusBadge status={monitor.lastStatus} />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-2xl font-semibold tracking-tight">
                {monitor.name}
              </p>
              <MonitorTargetLink monitor={monitor} />
              <p className="text-sm text-muted-foreground">
                {m.monitor_interval_assertion_summary({
                  interval: monitor.intervalSec,
                  assertions: m.monitor_assertion_count({
                    count: monitor.assertions.length,
                  }),
                })}
              </p>
            </div>
          </div>
          <Tabs value={currentTab}>
            <TabsList>
              <TabsTrigger asChild value="overview">
                <Link
                  params={{ monitorId: monitor.id }}
                  to="/monitors/$monitorId"
                >
                  {m.monitor_overview()}
                </Link>
              </TabsTrigger>
              <TabsTrigger asChild value="logs">
                <Link
                  params={{ monitorId: monitor.id }}
                  search={{ page: 1 }}
                  to="/monitors/$monitorId/logs"
                >
                  {m.monitor_logs()}
                </Link>
              </TabsTrigger>
              <TabsTrigger asChild value="incidents">
                <Link
                  params={{ monitorId: monitor.id }}
                  to="/monitors/$monitorId/incidents"
                >
                  {m.nav_incidents()}
                </Link>
              </TabsTrigger>
              <TabsTrigger asChild value="settings">
                <Link
                  params={{ monitorId: monitor.id }}
                  to="/monitors/$monitorId/settings"
                >
                  {m.monitor_settings()}
                </Link>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {children(detail.data)}
      </div>
    </AppPage>
  );
}

export function displayMonitorTarget(monitor: MonitorRecord) {
  return monitor.kind === "push" && monitor.pushToken
    ? `/api/push/${monitor.pushToken}`
    : monitor.target;
}

function MonitorTargetLink({ monitor }: { monitor: MonitorRecord }) {
  const target = displayMonitorTarget(monitor);

  return (
    <a
      className="w-fit text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      href={target}
      rel="noreferrer"
      target="_blank"
    >
      {target}
    </a>
  );
}
