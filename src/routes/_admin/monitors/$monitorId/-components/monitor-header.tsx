import type { ReactNode } from "react";

import type { MonitorAssertion, MonitorDetailData } from "@/types";

import { LiveTime } from "@/components/live-time";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatDateTime,
  formatDurationMs,
  formatUptimePercent,
  notificationSummary,
} from "@/lib/formatters";
import { useMonitorQuery } from "@/lib/queries/monitors";
import { providerLabel } from "@/lib/queries/notifications";
import { m } from "@/paraglide/messages.js";

import { CheckHistory } from "../-components/check-history";
import { IncidentList } from "../-components/incident-list";
import { MonitorWorkspacePage } from "../../-components/monitor-workspace-page";

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
            <CardTitle className="text-2xl">
              {data.metrics.windows[0]?.uptimePercentage == null
                ? m.common_not_available()
                : `${formatUptimePercent(data.metrics.windows[0].uptimePercentage)}%`}
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
            <CardTitle className="text-2xl">
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
            <CardTitle className="text-2xl">
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
            <CardTitle className="text-2xl">
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
            <CardTitle className="text-2xl">
              <LiveTime value={data.metrics.lastCheckedAt} />
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

      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-medium">
              {m.monitor_availability_windows()}
            </h2>
            <p className="text-sm text-muted-foreground">
              {m.monitor_availability_windows_description()}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.metrics.windows.map((window) => (
              <Card key={window.label} size="sm">
                <CardHeader className="gap-1">
                  <CardDescription className="font-medium">
                    {window.label}
                  </CardDescription>
                  <CardTitle className="text-2xl">
                    {window.uptimePercentage == null
                      ? m.common_not_available()
                      : `${formatUptimePercent(window.uptimePercentage)}%`}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {m.monitor_check_window_summary({
                      total: window.totalChecks,
                      up: window.upChecks,
                    })}
                  </p>
                </CardHeader>
              </Card>
            ))}
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
              <OverviewStatLabel>
                {m.monitor_open_incidents()}
              </OverviewStatLabel>
              <OverviewStatValue>
                {
                  data.incidents.filter(
                    (incident) => incident.status === "open",
                  ).length
                }
              </OverviewStatValue>
            </OverviewStat>
            <OverviewStat>
              <OverviewStatLabel>{m.monitor_incidents()}</OverviewStatLabel>
              <OverviewStatValue>{data.incidents.length}</OverviewStatValue>
            </OverviewStat>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-medium">{m.monitor_assertions()}</h2>
            <p className="text-sm text-muted-foreground">
              {m.monitor_assertions_overview_description()}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {data.monitor.assertions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {m.monitor_no_assertions()}
              </p>
            ) : (
              data.monitor.assertions.map((assertion, index) => (
                <OverviewListRow key={assertion.id}>
                  <OverviewListRowLabel>
                    {m.monitor_assertion_label({ number: index + 1 })}
                  </OverviewListRowLabel>
                  <OverviewListRowValue>
                    {assertionSummary(assertion)}
                  </OverviewListRowValue>
                </OverviewListRow>
              ))
            )}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-medium">
                {m.monitor_notifications()}
              </h2>
              <p className="text-sm text-muted-foreground">
                {m.monitor_notifications_overview_description()}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {data.notificationDestinations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {m.monitor_no_destinations()}
                </p>
              ) : (
                data.notificationDestinations.map((destination) => (
                  <OverviewCardRow key={destination.id}>
                    <OverviewListRowLabel>
                      {destination.name}
                    </OverviewListRowLabel>
                    <OverviewListRowValue>
                      {providerLabel(destination.provider)} ·{" "}
                      {notificationSummary(destination)}
                    </OverviewListRowValue>
                  </OverviewCardRow>
                ))
              )}
            </div>
          </section>
          <IncidentList incidents={data.incidents} monitorId={monitorId} />
        </div>
      </div>
    </div>
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
        accent === "emerald" ? "border-success/30 bg-success/5" : undefined
      }
      size="sm"
    >
      <CardHeader className="gap-2">{children}</CardHeader>
    </Card>
  );
}

function OverviewMetricCardBody({ children }: { children: ReactNode }) {
  return <div className="grid gap-1">{children}</div>;
}

function OverviewMetricCardMeta({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function OverviewStat({ children }: { children: ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader className="gap-1">{children}</CardHeader>
    </Card>
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

function OverviewListRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1">{children}</div>;
}

function OverviewCardRow({ children }: { children: ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader className="gap-1">{children}</CardHeader>
    </Card>
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
