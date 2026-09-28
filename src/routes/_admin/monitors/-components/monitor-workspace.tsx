import type { ReactNode } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  LayoutDashboardIcon,
  ListIcon,
  SettingsIcon,
  SirenIcon,
} from "lucide-react";

import type { MonitorDetailData, MonitorRecord } from "@/types";

import { AppPage } from "@/components/page";
import { Separator } from "@/components/ui/separator";
import {
  monitorQueryOptions,
  monitorStateQueryOptions,
} from "@/lib/queries/monitors";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

// Detail data merged with the faster-polling state query, which owns the
// monitor's live fields. Both are loaded by the `$monitorId` layout route.
export function useMonitorWorkspaceData(monitorId: string): MonitorDetailData {
  const { data: detail } = useSuspenseQuery(monitorQueryOptions(monitorId));

  const { data: monitor } = useSuspenseQuery(
    monitorStateQueryOptions(monitorId),
  );

  return {
    ...detail,
    monitor,
    metrics: {
      ...detail.metrics,
      lastCheckedAt: monitor.lastCheckedAt,
    },
  };
}

export function MonitorWorkspace({
  monitorId,
  children,
}: {
  monitorId: string;
  children: ReactNode;
}) {
  const { monitor } = useMonitorWorkspaceData(monitorId);

  return (
    <AppPage title={monitor.name}>
      <div className="grid gap-4">
        <div className="flex flex-col gap-6 py-2">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {monitor.name}
            </h1>
            <MonitorTargetLink monitor={monitor} />
            <p className="text-sm text-muted-foreground">
              {m.monitor_interval_assertion_summary({
                interval: monitor.intervalSec,
                assertions: m.monitor_assertion_count({
                  count: monitor.assertions.length,
                }),
              })}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{monitorKindLabel(monitor.kind)}</span>
              <span aria-hidden="true">·</span>
              <span>
                {monitor.active === 1 ? m.common_active() : m.common_paused()}
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2 rounded-full",
                    monitor.lastStatus === "up"
                      ? "bg-success"
                      : monitor.lastStatus === "down"
                        ? "bg-destructive"
                        : "bg-muted-foreground",
                  )}
                />
                {monitorStatusLabel(monitor.lastStatus)}
              </span>
            </div>
          </div>
          <div>
            <nav
              aria-label={m.monitor_navigation()}
              className="flex flex-wrap [&_svg]:size-4 [&_svg]:shrink-0"
            >
              <Link
                activeOptions={{ exact: true }}
                className={monitorNavigationClass}
                params={{ monitorId }}
                to="/monitors/$monitorId"
              >
                <LayoutDashboardIcon />
                {m.monitor_overview()}
              </Link>
              <Link
                activeOptions={{ includeSearch: false }}
                className={monitorNavigationClass}
                params={{ monitorId }}
                search={{ page: 1 }}
                to="/monitors/$monitorId/logs"
              >
                <ListIcon />
                {m.monitor_logs()}
              </Link>
              <Link
                className={monitorNavigationClass}
                params={{ monitorId }}
                to="/monitors/$monitorId/incidents"
              >
                <SirenIcon />
                {m.nav_incidents()}
              </Link>
              <Link
                className={monitorNavigationClass}
                params={{ monitorId }}
                to="/monitors/$monitorId/settings"
              >
                <SettingsIcon />
                {m.monitor_settings()}
              </Link>
            </nav>
            <Separator />
          </div>
        </div>
        {children}
      </div>
    </AppPage>
  );
}

// TanStack `Link` marks the matching tab with `data-status="active"`.
const monitorNavigationClass =
  "-mb-px flex shrink-0 items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:border-foreground data-[status=active]:text-foreground";

function monitorKindLabel(kind: MonitorRecord["kind"]) {
  return kind === "http"
    ? m.monitor_http()
    : kind === "dns"
      ? m.monitor_dns()
      : m.monitor_heartbeat();
}

function monitorStatusLabel(status: MonitorRecord["lastStatus"]) {
  return status === "up"
    ? m.common_operational()
    : status === "down"
      ? m.common_down()
      : m.common_unknown();
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
