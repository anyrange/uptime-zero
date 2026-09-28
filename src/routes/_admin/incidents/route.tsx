import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useState } from "react";
import { z } from "zod";

import type { IncidentListRecord } from "@/types";

import { DataTable } from "@/components/data-table";
import { IncidentDuration } from "@/components/incident-duration";
import { IncidentStatusBadge } from "@/components/incident-status-badge";
import {
  AppPage,
  AppPageHeader,
  AppPageHeaderContent,
  AppPageLabel,
  AppPageSubtitle,
} from "@/components/page";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/formatters";
import {
  dashboardQueryOptions,
  incidentsQueryOptions,
} from "@/lib/queries/dashboard";
import { m } from "@/paraglide/messages.js";

import { IncidentsSkeleton } from "./-components/incidents-skeleton";

const incidentsSearchSchema = z.object({
  monitor: z.string().optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  status: z.enum(["open", "closed", "all"]).optional().catch(undefined),
});

export const Route = createFileRoute("/_admin/incidents")({
  validateSearch: incidentsSearchSchema,
  loaderDeps: ({ search }) => ({
    ...search,
    status: search.status ?? "all",
  }),
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(incidentsQueryOptions(deps));
  },
  pendingComponent: IncidentsSkeleton,
  component: IncidentsRoute,
});

const ALL_MONITORS_VALUE = "__all_monitors__";

function IncidentsRoute() {
  const navigate = Route.useNavigate();
  const search = Route.useLoaderDeps();

  const [statusValue, setStatusValue] = useState(search.status);

  const [monitorValue, setMonitorValue] = useState(
    search.monitor ?? ALL_MONITORS_VALUE,
  );

  const [queryValue, setQueryValue] = useState(search.q ?? "");
  const { data: dashboard } = useSuspenseQuery(dashboardQueryOptions());
  const { data: incidents } = useSuspenseQuery(incidentsQueryOptions(search));

  useEffect(() => {
    setStatusValue(search.status);
    setMonitorValue(search.monitor ?? ALL_MONITORS_VALUE);
    setQueryValue(search.q ?? "");
  }, [search.monitor, search.q, search.status]);

  const updateSearch = async (next: {
    status?: typeof search.status;
    monitor?: string;
    q?: string;
  }) => {
    await navigate({
      to: "/incidents",
      search: () => ({
        status: next.status && next.status !== "all" ? next.status : undefined,
        monitor:
          next.monitor && next.monitor !== ALL_MONITORS_VALUE
            ? next.monitor
            : undefined,
        q: next.q?.trim() ? next.q.trim() : undefined,
      }),
      replace: true,
    });
  };

  const handleStatusChange = (value: string) => {
    if (value === "open" || value === "closed" || value === "all") {
      setStatusValue(value);
      void updateSearch({
        status: value,
        monitor: monitorValue,
        q: queryValue,
      });
    }
  };

  useEffect(() => {
    const normalizedQuery = queryValue.trim();
    const currentQuery = search.q ?? "";

    if (normalizedQuery === currentQuery) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void updateSearch({
        status: statusValue,
        monitor: monitorValue,
        q: queryValue,
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [monitorValue, navigate, queryValue, search.q, statusValue]);

  return (
    <AppPage title={m.incident_history()}>
      <AppPageHeader>
        <AppPageHeaderContent>
          <AppPageLabel>{m.incident_history()}</AppPageLabel>
          <AppPageSubtitle>{m.incident_description()}</AppPageSubtitle>
        </AppPageHeaderContent>
      </AppPageHeader>
      <div className="grid gap-3 md:grid-cols-[180px_260px_minmax(280px,1fr)] md:items-center">
        <Select onValueChange={handleStatusChange} value={statusValue}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={m.incident_all()} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{m.incident_all()}</SelectItem>
            <SelectItem value="open">{m.incident_open()}</SelectItem>
            <SelectItem value="closed">{m.incident_closed()}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          onValueChange={(value) => {
            setMonitorValue(value);
            void updateSearch({
              status: statusValue,
              monitor: value,
              q: queryValue,
            });
          }}
          value={monitorValue}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={m.incident_all_monitors()} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_MONITORS_VALUE}>
              {m.incident_all_monitors()}
            </SelectItem>
            {dashboard.monitors.map((monitor) => (
              <SelectItem key={monitor.id} value={monitor.id}>
                {monitor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          name="q"
          onChange={(event) => setQueryValue(event.target.value)}
          placeholder={m.common_search()}
          value={queryValue}
        />
      </div>
      <IncidentsTable incidents={incidents} />
    </AppPage>
  );
}

function IncidentsTable({ incidents }: { incidents: IncidentListRecord[] }) {
  const table = useReactTable({
    data: incidents,
    columns: incidentColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DataTable
      columnsLength={incidentColumns.length}
      empty={m.incident_no_incidents()}
      table={table}
    />
  );
}

const incidentColumns: ColumnDef<IncidentListRecord>[] = [
  {
    accessorKey: "status",
    header: m.common_status(),
    cell: ({ row }) => <IncidentStatusBadge status={row.original.status} />,
    size: 120,
  },
  {
    accessorKey: "title",
    header: m.incident_incident(),
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="font-medium break-words whitespace-normal">
          {row.original.title}
        </p>
        <p className="mt-1 text-sm break-words whitespace-normal text-muted-foreground">
          {row.original.body ?? m.incident_no_summary()}
        </p>
      </div>
    ),
    size: 240,
  },
  {
    accessorKey: "monitorName",
    header: m.incident_monitor(),
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.monitorName}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {row.original.monitorKind}
        </p>
      </div>
    ),
    size: 240,
  },
  {
    accessorKey: "openedAt",
    header: m.incident_opened(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDateTime(row.original.openedAt)}
      </span>
    ),
    size: 200,
  },
  {
    id: "duration",
    header: m.common_duration(),
    cell: ({ row }) => (
      <IncidentDuration
        className="text-muted-foreground"
        incident={row.original}
      />
    ),
    size: 110,
  },
  {
    accessorKey: "closedAt",
    header: m.incident_closed_at(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDateTime(row.original.closedAt)}
      </span>
    ),
    size: 200,
  },
];
