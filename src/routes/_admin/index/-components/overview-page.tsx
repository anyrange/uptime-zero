import { Link } from "@tanstack/react-router";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, type ReactNode } from "react";

import type { DashboardData, HeartbeatRecord, IncidentRecord } from "@/types";

import { DataTable } from "@/components/data-table";
import { Error } from "@/components/error";
import { IncidentDuration } from "@/components/incident-duration";
import { IncidentStatusBadge } from "@/components/incident-status-badge";
import { LiveTime } from "@/components/live-time";
import {
  AppPage,
  AppPageHeader,
  AppPageHeaderContent,
  AppPageLabel,
  AppPageSubtitle,
} from "@/components/page";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { formatDateTime, formatDurationMs } from "@/lib/formatters";
import { useDashboardQuery } from "@/lib/queries/dashboard";
import { m } from "@/paraglide/messages.js";

import { OverviewSkeleton } from "./overview-skeleton";

export function OverviewPage() {
  const dashboard = useDashboardQuery();

  return (
    <AppPage title={m.overview_title()}>
      <AppPageHeader>
        <AppPageHeaderContent>
          <AppPageLabel>{m.overview_title()}</AppPageLabel>
          <AppPageSubtitle>{m.overview_description()}</AppPageSubtitle>
        </AppPageHeaderContent>
      </AppPageHeader>
      {dashboard.status === "pending" ? <OverviewSkeleton /> : null}
      {dashboard.status === "error" ? (
        <Error message={dashboard.error.message} />
      ) : null}
      {dashboard.status === "success" ? (
        <OverviewContent data={dashboard.data} />
      ) : null}
    </AppPage>
  );
}

function OverviewContent({ data }: { data: DashboardData }) {
  const incidents = useMemo(
    () => getRecentIncidents(data.incidents),
    [data.incidents],
  );
  const recentIncident = incidents[0];

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card size="sm">
          <CardContent className="grid gap-1.5">
            <CardDescription>{m.common_status()}</CardDescription>
            <CardTitle>{getOverallStatusLabel(data.overallStatus)}</CardTitle>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <Link className="grid gap-1.5" to="/monitors">
              <CardDescription>{m.monitor_monitors()}</CardDescription>
              <CardTitle>{data.monitors.length}</CardTitle>
            </Link>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <Link className="grid gap-1.5" to="/status-pages">
              <CardDescription>{m.overview_status_pages()}</CardDescription>
              <CardTitle>{data.statusPages.length}</CardTitle>
            </Link>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <Link
              className="grid gap-1.5"
              search={{ monitor: undefined, q: undefined, status: "all" }}
              to="/incidents"
            >
              <CardDescription>{m.monitor_open_incidents()}</CardDescription>
              <CardTitle>{data.openIncidentCount}</CardTitle>
            </Link>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <Link
              className="grid gap-1.5"
              search={{ monitor: undefined, q: undefined, status: "all" }}
              to="/incidents"
            >
              <CardDescription>{m.overview_recent_incident()}</CardDescription>
              <CardTitle>
                {recentIncident ? (
                  <LiveTime value={recentIncident.openedAt} />
                ) : (
                  m.common_none()
                )}
              </CardTitle>
            </Link>
          </CardContent>
        </Card>
      </div>
      <OverviewSection>
        <OverviewSectionHeader>
          <OverviewSectionTitle>
            {m.overview_incidents_heading()}
          </OverviewSectionTitle>
          <OverviewSectionDescription>
            {m.overview_incidents_description()}
          </OverviewSectionDescription>
        </OverviewSectionHeader>
        <RecentIncidentsTable data={data} incidents={incidents} />
      </OverviewSection>
      <OverviewSection>
        <OverviewSectionHeader>
          <OverviewSectionTitle>
            {m.overview_latest_checks_heading()}
          </OverviewSectionTitle>
          <OverviewSectionDescription>
            {m.overview_latest_checks_description()}
          </OverviewSectionDescription>
        </OverviewSectionHeader>
        <LatestCheckMetrics data={data} />
        <LatestChecksTable data={data} />
      </OverviewSection>
    </div>
  );
}

function OverviewSection({ children }: { children: ReactNode }) {
  return <section className="flex min-w-0 flex-col gap-3">{children}</section>;
}

function OverviewSectionHeader({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

function OverviewSectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-xl font-semibold tracking-tight">{children}</h2>;
}

function OverviewSectionDescription({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-sm text-muted-foreground">{children}</p>;
}

function LatestCheckMetrics({ data }: { data: DashboardData }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card size="sm">
        <CardContent className="grid gap-1.5">
          <CardDescription>{m.overview_checks_last_hour()}</CardDescription>
          <CardTitle>{formatCount(data.heartbeatCounts.lastHour)}</CardTitle>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="grid gap-1.5">
          <CardDescription>{m.overview_checks_last_day()}</CardDescription>
          <CardTitle>{formatCount(data.heartbeatCounts.lastDay)}</CardTitle>
        </CardContent>
      </Card>
    </div>
  );
}

function LatestChecksTable({ data }: { data: DashboardData }) {
  const rows = useMemo(() => {
    const monitorNames = new Map(
      data.monitors.map((monitor) => [monitor.id, monitor.name]),
    );
    return data.heartbeats.slice(0, 10).map((heartbeat) => ({
      heartbeat,
      monitorName: monitorNames.get(heartbeat.monitorId),
    }));
  }, [data.heartbeats, data.monitors]);
  const table = useReactTable({
    data: rows,
    columns: latestCheckColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.heartbeats.length === 0) {
    return <Empty>{m.monitor_no_heartbeat_logs()}</Empty>;
  }

  return (
    <DataTable
      columnsLength={latestCheckColumns.length}
      empty={m.monitor_no_heartbeat_logs()}
      table={table}
    />
  );
}

interface LatestCheckRow {
  heartbeat: HeartbeatRecord;
  monitorName: string | undefined;
}

const latestCheckColumns: ColumnDef<LatestCheckRow>[] = [
  {
    id: "monitor",
    header: () => <span className="pl-5">{m.incident_monitor()}</span>,
    cell: ({ row }) => (
      <div className="min-w-0 pl-5">
        <Button
          asChild
          className="h-auto max-w-full p-0 font-medium"
          variant="link"
        >
          <Link
            className="truncate"
            params={{ monitorId: row.original.heartbeat.monitorId }}
            to="/monitors/$monitorId"
          >
            {row.original.monitorName ?? row.original.heartbeat.monitorId}
          </Link>
        </Button>
      </div>
    ),
    size: 220,
  },
  {
    accessorFn: (row) => row.heartbeat.createdAt,
    header: m.monitor_timestamp(),
    cell: ({ row }) => (
      <LiveTime
        className="text-muted-foreground"
        mode="absolute"
        value={row.original.heartbeat.createdAt}
      />
    ),
    size: 200,
  },
  {
    accessorFn: (row) => row.heartbeat.status,
    header: m.common_status(),
    cell: ({ row }) => <StatusBadge status={row.original.heartbeat.status} />,
    size: 140,
  },
  {
    accessorFn: (row) => row.heartbeat.statusCode,
    header: m.monitor_code(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.heartbeat.statusCode ?? m.common_not_available()}
      </span>
    ),
    size: 90,
  },
  {
    accessorFn: (row) => row.heartbeat.durationMs,
    header: m.monitor_latency(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDurationMs(row.original.heartbeat.durationMs)}
      </span>
    ),
    size: 130,
  },
  {
    accessorFn: (row) => row.heartbeat.source,
    header: m.monitor_source(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.heartbeat.source}
      </span>
    ),
    size: 120,
  },
  {
    id: "details",
    header: () => <span className="pr-5">{m.monitor_details()}</span>,
    cell: ({ row }) => (
      <span className="block truncate pr-5 text-sm text-muted-foreground">
        {row.original.heartbeat.error ?? m.common_healthy()}
      </span>
    ),
    size: 220,
  },
];

function RecentIncidentsTable({
  data,
  incidents,
}: {
  data: DashboardData;
  incidents: IncidentRecord[];
}) {
  const rows = useMemo(() => {
    const monitorNames = new Map(
      data.monitors.map((monitor) => [monitor.id, monitor.name]),
    );
    return incidents.map((incident) => ({
      incident,
      monitorName: monitorNames.get(incident.monitorId),
    }));
  }, [data.monitors, incidents]);
  const table = useReactTable({
    data: rows,
    columns: recentIncidentColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (incidents.length === 0) {
    return <Empty>{m.incident_no_incidents()}</Empty>;
  }

  return (
    <DataTable
      columnsLength={recentIncidentColumns.length}
      empty={m.incident_no_incidents()}
      table={table}
    />
  );
}

interface RecentIncidentRow {
  incident: IncidentRecord;
  monitorName: string | undefined;
}

const recentIncidentColumns: ColumnDef<RecentIncidentRow>[] = [
  {
    id: "monitor",
    header: m.incident_monitor(),
    cell: ({ row }) => (
      <div className="min-w-0">
        <Button
          asChild
          className="h-auto max-w-full p-0 font-medium"
          variant="link"
        >
          <Link
            className="truncate"
            params={{ monitorId: row.original.incident.monitorId }}
            to="/monitors/$monitorId/incidents"
          >
            {row.original.monitorName ?? row.original.incident.title}
          </Link>
        </Button>
      </div>
    ),
    size: 260,
  },
  {
    accessorFn: (row) => row.incident.status,
    header: m.common_status(),
    cell: ({ row }) => (
      <IncidentStatusBadge status={row.original.incident.status} />
    ),
    size: 120,
  },
  {
    accessorFn: (row) => row.incident.openedAt,
    header: m.incident_opened(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDateTime(row.original.incident.openedAt)}
      </span>
    ),
    size: 220,
  },
  {
    accessorFn: (row) => row.incident.closedAt,
    header: m.incident_closed_at(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDateTime(row.original.incident.closedAt)}
      </span>
    ),
    size: 220,
  },
  {
    id: "duration",
    header: m.common_duration(),
    cell: ({ row }) => (
      <IncidentDuration
        className="text-muted-foreground"
        incident={row.original.incident}
      />
    ),
    size: 110,
  },
];

function getRecentIncidents(incidents: IncidentRecord[]) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return incidents.filter((incident) => {
    const openedAt = new Date(incident.openedAt).getTime();
    return !Number.isNaN(openedAt) && openedAt >= cutoff;
  });
}

function getOverallStatusLabel(status: DashboardData["overallStatus"]) {
  if (status === "up") {
    return m.common_operational();
  }

  if (status === "down") {
    return m.common_down();
  }

  return m.common_unknown();
}

function formatCount(value: number) {
  return new Intl.NumberFormat().format(value);
}
