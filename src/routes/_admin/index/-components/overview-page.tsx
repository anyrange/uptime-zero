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
import { IncidentStatusBadge } from "@/components/incident-status-badge";
import { Loading } from "@/components/loading";
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import {
  formatDateTime,
  formatDurationMs,
  formatIncidentDuration,
  formatRelativeDateTime,
} from "@/lib/formatters";
import {
  DASHBOARD_POLL_INTERVAL_MS,
  useDashboardQuery,
} from "@/lib/queries/dashboard";
import { m } from "@/paraglide/messages.js";

export function OverviewPage() {
  const dashboard = useDashboardQuery(DASHBOARD_POLL_INTERVAL_MS);

  return (
    <AppPage title={m.overview_title()}>
      <AppPageHeader>
        <AppPageHeaderContent>
          <AppPageLabel>{m.overview_title()}</AppPageLabel>
          <AppPageSubtitle>{m.overview_description()}</AppPageSubtitle>
        </AppPageHeaderContent>
      </AppPageHeader>
      {dashboard.status === "pending" ? <Loading /> : null}
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
    <div className="flex flex-col gap-8">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <OverviewMetricCard>
          <CardDescription>{m.common_status()}</CardDescription>
          <CardTitle>{getOverallStatusLabel(data.overallStatus)}</CardTitle>
        </OverviewMetricCard>
        <OverviewMetricCard>
          <Link className="grid gap-1.5" to="/monitors">
            <CardDescription>{m.monitor_monitors()}</CardDescription>
            <CardTitle>{data.monitors.length}</CardTitle>
          </Link>
        </OverviewMetricCard>
        <OverviewMetricCard>
          <Link className="grid gap-1.5" to="/status-pages">
            <CardDescription>{m.overview_status_pages()}</CardDescription>
            <CardTitle>{data.statusPages.length}</CardTitle>
          </Link>
        </OverviewMetricCard>
        <OverviewMetricCard>
          <Link
            className="grid gap-1.5"
            search={{ monitor: undefined, q: undefined, status: "all" }}
            to="/incidents"
          >
            <CardDescription>{m.monitor_open_incidents()}</CardDescription>
            <CardTitle>{data.openIncidentCount}</CardTitle>
          </Link>
        </OverviewMetricCard>
        <OverviewMetricCard>
          <Link
            className="grid gap-1.5"
            search={{ monitor: undefined, q: undefined, status: "all" }}
            to="/incidents"
          >
            <CardDescription>{m.overview_recent_incident()}</CardDescription>
            <CardTitle>
              {recentIncident
                ? formatRelativeDateTime(recentIncident.openedAt)
                : m.common_none()}
            </CardTitle>
          </Link>
        </OverviewMetricCard>
      </div>
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
    </div>
  );
}

function OverviewMetricCard({ children }: { children: ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>{children}</CardHeader>
    </Card>
  );
}

function OverviewSection({ children }: { children: ReactNode }) {
  return <section className="flex flex-col gap-3">{children}</section>;
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
      <OverviewMetricCard>
        <CardDescription>{m.overview_checks_last_hour()}</CardDescription>
        <CardTitle>{formatCount(data.heartbeatCounts.lastHour)}</CardTitle>
      </OverviewMetricCard>
      <OverviewMetricCard>
        <CardDescription>{m.overview_checks_last_day()}</CardDescription>
        <CardTitle>{formatCount(data.heartbeatCounts.lastDay)}</CardTitle>
      </OverviewMetricCard>
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
      <div className="pl-5">
        <Button asChild className="h-auto p-0 font-medium" variant="link">
          <Link
            params={{ monitorId: row.original.heartbeat.monitorId }}
            to="/monitors/$monitorId"
          >
            {row.original.monitorName ?? row.original.heartbeat.monitorId}
          </Link>
        </Button>
      </div>
    ),
  },
  {
    accessorFn: (row) => row.heartbeat.createdAt,
    header: m.monitor_timestamp(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDateTime(row.original.heartbeat.createdAt)}
      </span>
    ),
  },
  {
    accessorFn: (row) => row.heartbeat.status,
    header: m.common_status(),
    cell: ({ row }) => <StatusBadge status={row.original.heartbeat.status} />,
  },
  {
    accessorFn: (row) => row.heartbeat.statusCode,
    header: m.monitor_code(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.heartbeat.statusCode ?? m.common_not_available()}
      </span>
    ),
  },
  {
    accessorFn: (row) => row.heartbeat.durationMs,
    header: m.monitor_latency(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDurationMs(row.original.heartbeat.durationMs)}
      </span>
    ),
  },
  {
    accessorFn: (row) => row.heartbeat.source,
    header: m.monitor_source(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.heartbeat.source}
      </span>
    ),
  },
  {
    id: "details",
    header: () => <span className="pr-5">{m.monitor_details()}</span>,
    cell: ({ row }) => (
      <span className="pr-5 text-sm text-muted-foreground">
        {row.original.heartbeat.error ?? m.common_healthy()}
      </span>
    ),
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
      <Button asChild className="h-auto p-0 font-medium" variant="link">
        <Link
          params={{ monitorId: row.original.incident.monitorId }}
          to="/monitors/$monitorId"
        >
          {row.original.monitorName ?? row.original.incident.title}
        </Link>
      </Button>
    ),
  },
  {
    accessorFn: (row) => row.incident.status,
    header: m.common_status(),
    cell: ({ row }) => (
      <IncidentStatusBadge status={row.original.incident.status} />
    ),
  },
  {
    accessorFn: (row) => row.incident.openedAt,
    header: m.incident_opened(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDateTime(row.original.incident.openedAt)}
      </span>
    ),
  },
  {
    accessorFn: (row) => row.incident.closedAt,
    header: m.incident_closed_at(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDateTime(row.original.incident.closedAt)}
      </span>
    ),
  },
  {
    id: "duration",
    header: m.common_duration(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatIncidentDuration(row.original.incident)}
      </span>
    ),
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
