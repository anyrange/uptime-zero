import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";

import type {
  MonitorAssertion,
  MonitorDetailData,
  MonitorRecord,
} from "@/types";

import { Error } from "@/components/error";
import { Loading } from "@/components/loading";
import { AppPage } from "@/components/page";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatDateTime,
  formatDurationMs,
  formatRelativeDateTime,
  notificationSummary,
} from "@/lib/formatters";
import { useMonitorQuery } from "@/lib/queries/monitors";
import { providerLabel } from "@/lib/queries/notifications";
import { m } from "@/paraglide/messages.js";

import { CheckHistory } from "../-components/check-history";
import { IncidentList } from "../-components/incident-list";

export function MonitorDetailPage({ monitorId }: { monitorId: string }) {
  const detail = useMonitorQuery(monitorId);

  return (
    <MonitorWorkspacePage currentTab="overview" detail={detail}>
      {(data) => <MonitorOverviewContent data={data} monitorId={monitorId} />}
    </MonitorWorkspacePage>
  );
}

function MonitorOverviewContent({
  data,
  monitorId,
}: {
  data: MonitorDetailData;
  monitorId: string;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <OverviewMetricCard accent="emerald">
          <OverviewMetricCardBody>
            <CardDescription className="text-sm font-medium">
              {data.metrics.windows[0]?.label ?? m.monitor_availability()}
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">
              {data.metrics.windows[0]?.uptimePercentage == null
                ? m.common_not_available()
                : `${data.metrics.windows[0].uptimePercentage.toFixed(2)}%`}
            </CardTitle>
          </OverviewMetricCardBody>
          <OverviewMetricCardMeta>
            {data.metrics.windows[0] == null
              ? m.monitor_no_checks_recorded()
              : m.monitor_successful_check_ratio({
                  up: data.metrics.windows[0].upChecks,
                  total: data.metrics.windows[0].totalChecks,
                })}
          </OverviewMetricCardMeta>
        </OverviewMetricCard>
        <OverviewMetricCard>
          <OverviewMetricCardBody>
            <CardDescription className="text-sm font-medium">
              {m.monitor_requests()}
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">
              {data.metrics.requestCount}
            </CardTitle>
          </OverviewMetricCardBody>
          <OverviewMetricCardMeta>
            {m.monitor_cadence_summary({ interval: data.monitor.intervalSec })}
          </OverviewMetricCardMeta>
        </OverviewMetricCard>
        <OverviewMetricCard>
          <OverviewMetricCardBody>
            <CardDescription className="text-sm font-medium">
              {m.monitor_p50_latency()}
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">
              {formatDurationMs(data.metrics.p50ResponseMs)}
            </CardTitle>
          </OverviewMetricCardBody>
          <OverviewMetricCardMeta>
            {m.monitor_p95_latency_value({
              value: formatDurationMs(data.metrics.p95ResponseMs),
            })}
          </OverviewMetricCardMeta>
        </OverviewMetricCard>
        <OverviewMetricCard>
          <OverviewMetricCardBody>
            <CardDescription className="text-sm font-medium">
              {m.monitor_p99_latency()}
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">
              {formatDurationMs(data.metrics.p99ResponseMs)}
            </CardTitle>
          </OverviewMetricCardBody>
          <OverviewMetricCardMeta>
            {m.monitor_average_latency_value({
              value: formatDurationMs(data.metrics.averageResponseMs),
            })}
          </OverviewMetricCardMeta>
        </OverviewMetricCard>
        <OverviewMetricCard>
          <OverviewMetricCardBody>
            <CardDescription className="text-sm font-medium">
              {m.monitor_last_checked()}
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">
              {formatRelativeDateTime(data.metrics.lastCheckedAt)}
            </CardTitle>
          </OverviewMetricCardBody>
          <OverviewMetricCardMeta>
            {formatDateTime(data.metrics.lastCheckedAt)}
          </OverviewMetricCardMeta>
        </OverviewMetricCard>
      </div>

      <CheckHistory
        heartbeats={data.heartbeats}
        incidents={data.incidents}
        monitorKind={data.monitor.kind}
        requestCount={data.metrics.requestCount}
      />

      <div className="grid gap-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(16rem,3fr)]">
          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">
                {m.monitor_availability_windows()}
              </CardTitle>
              <CardDescription>
                Uptime summaries across the retention windows currently backed
                by monitor history.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto grid gap-3 md:grid-cols-3">
              {data.metrics.windows.map((window) => (
                <div
                  className="grid gap-2 rounded-lg border border-border/70 bg-muted/20 px-4 py-4"
                  key={window.label}
                >
                  <p className="text-sm font-medium text-muted-foreground">
                    {window.label}
                  </p>
                  <p className="text-2xl font-semibold text-foreground">
                    {window.uptimePercentage == null
                      ? m.common_not_available()
                      : `${window.uptimePercentage.toFixed(2)}%`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {m.monitor_check_window_summary({
                      total: window.totalChecks,
                      up: window.upChecks,
                    })}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <OverviewStat>
              <OverviewStatLabel>
                {m.monitor_mean_time_to_recovery()}
              </OverviewStatLabel>
              <OverviewStatValue>
                {data.metrics.mttrMinutes == null
                  ? m.common_not_available()
                  : m.monitor_mttr_minutes({
                      minutes: data.metrics.mttrMinutes,
                    })}
              </OverviewStatValue>
            </OverviewStat>
            <OverviewStat>
              <OverviewStatLabel>Open incidents</OverviewStatLabel>
              <OverviewStatValue>
                {
                  data.incidents.filter(
                    (incident) => incident.status === "open",
                  ).length
                }
              </OverviewStatValue>
            </OverviewStat>
            <OverviewStat>
              <OverviewStatLabel>Incidents</OverviewStatLabel>
              <OverviewStatValue>{data.incidents.length}</OverviewStatValue>
            </OverviewStat>
          </div>
        </div>
        <OverviewList>
          <OverviewListHeader>
            <CardTitle className="text-base">Assertions</CardTitle>
            <CardDescription>
              Expectations the monitor enforces on each run.
            </CardDescription>
          </OverviewListHeader>
          <OverviewListContent>
            {data.monitor.assertions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No assertions configured.
              </p>
            ) : (
              data.monitor.assertions.map((assertion, index) => (
                <OverviewListRow key={assertion.id}>
                  <OverviewListRowLabel>
                    Assertion {index + 1}
                  </OverviewListRowLabel>
                  <OverviewListRowValue>
                    {assertionSummary(assertion)}
                  </OverviewListRowValue>
                </OverviewListRow>
              ))
            )}
          </OverviewListContent>
        </OverviewList>
        <div className="grid gap-4 lg:grid-cols-2">
          <OverviewList>
            <OverviewListHeader>
              <CardTitle className="text-base">Notifications</CardTitle>
              <CardDescription>
                Destinations currently attached to this monitor.
              </CardDescription>
            </OverviewListHeader>
            <OverviewListContent>
              {data.notificationDestinations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No destinations are bound.
                </p>
              ) : (
                data.notificationDestinations.map((destination) => (
                  <OverviewListRow key={destination.id}>
                    <OverviewListRowLabel>
                      {destination.name}
                    </OverviewListRowLabel>
                    <OverviewListRowValue>
                      {providerLabel(destination.provider)} ·{" "}
                      {notificationSummary(destination)}
                    </OverviewListRowValue>
                  </OverviewListRow>
                ))
              )}
            </OverviewListContent>
          </OverviewList>
          <IncidentList incidents={data.incidents} monitorId={monitorId} />
        </div>
      </div>
    </div>
  );
}

function MonitorWorkspacePage({
  detail,
  currentTab,
  children,
}: {
  detail: UseQueryResult<MonitorDetailData, Error>;
  currentTab: "overview" | "logs" | "incidents" | "settings";
  children: (data: MonitorDetailData) => ReactNode;
}) {
  if (detail.status === "pending") {
    return <Loading />;
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
                <Badge
                  className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                  variant="outline"
                >
                  {m.common_active()}
                </Badge>
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
                  Overview
                </Link>
              </TabsTrigger>
              <TabsTrigger asChild value="logs">
                <Link
                  params={{ monitorId: monitor.id }}
                  search={{ page: 1 }}
                  to="/monitors/$monitorId/logs"
                >
                  Logs
                </Link>
              </TabsTrigger>
              <TabsTrigger asChild value="incidents">
                <Link
                  params={{ monitorId: monitor.id }}
                  to="/monitors/$monitorId/incidents"
                >
                  Incidents
                </Link>
              </TabsTrigger>
              <TabsTrigger asChild value="settings">
                <Link
                  params={{ monitorId: monitor.id }}
                  to="/monitors/$monitorId/settings"
                >
                  Settings
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

function OverviewMetricCard({
  children,
  accent = "default",
}: {
  children: ReactNode;
  accent?: "default" | "emerald";
}) {
  return (
    <Card
      className={
        accent === "emerald"
          ? "border-emerald-500/30 bg-emerald-500/6"
          : undefined
      }
      size="sm"
    >
      <CardHeader className="gap-3">{children}</CardHeader>
    </Card>
  );
}

function OverviewMetricCardBody({ children }: { children: ReactNode }) {
  return <div className="space-y-1">{children}</div>;
}

function OverviewMetricCardMeta({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function OverviewStat({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-1 rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
      {children}
    </div>
  );
}

function OverviewStatLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm font-medium text-muted-foreground">{children}</p>
  );
}

function OverviewStatValue({ children }: { children: ReactNode }) {
  return <p className="text-base font-semibold text-foreground">{children}</p>;
}

function OverviewList({ children }: { children: ReactNode }) {
  return <Card>{children}</Card>;
}

function OverviewListHeader({ children }: { children: ReactNode }) {
  return <CardHeader className="gap-1">{children}</CardHeader>;
}

function OverviewListContent({ children }: { children: ReactNode }) {
  return <CardContent className="grid gap-2">{children}</CardContent>;
}

function OverviewListRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-1 rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
      {children}
    </div>
  );
}

function OverviewListRowLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm font-medium text-muted-foreground">{children}</p>
  );
}

function OverviewListRowValue({ children }: { children: ReactNode }) {
  return <p className="text-sm text-foreground">{children}</p>;
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

function displayMonitorTarget(monitor: MonitorRecord) {
  return monitor.kind === "push" && monitor.pushToken
    ? `/api/push/${monitor.pushToken}`
    : monitor.target;
}

function assertionSummary(assertion: MonitorAssertion) {
  switch (assertion.type) {
    case "status":
      return m.monitor_assertion_status_summary({
        expected: assertion.expected,
      });
    case "header":
      return m.monitor_assertion_header_summary({
        header: assertion.header,
        operator: assertion.operator,
        value: assertion.value,
      });
    case "body":
      return assertion.source === "json"
        ? m.monitor_assertion_json_summary({
            path: assertion.path,
            operator: assertion.operator,
            value: assertion.value,
          })
        : m.monitor_assertion_body_summary({
            operator: assertion.operator,
            value: assertion.value,
          });
    case "record":
      return m.monitor_assertion_record_summary({
        recordType: assertion.recordType,
        operator: assertion.operator,
        value: assertion.value,
      });
  }
}
