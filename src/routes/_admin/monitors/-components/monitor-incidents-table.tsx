import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type { IncidentRecord } from "@/types";

import { DataTable } from "@/components/data-table";
import { IncidentDuration } from "@/components/incident-duration";
import { IncidentStatusBadge } from "@/components/incident-status-badge";
import { formatDateTime } from "@/lib/formatters";
import { m } from "@/paraglide/messages.js";

export function MonitorIncidentsTable({
  incidents,
}: {
  incidents: IncidentRecord[];
}) {
  const table = useReactTable({
    data: incidents,
    columns: monitorIncidentColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DataTable
      columnsLength={monitorIncidentColumns.length}
      empty={m.incident_no_incidents()}
      table={table}
    />
  );
}

const monitorIncidentColumns: ColumnDef<IncidentRecord>[] = [
  {
    accessorKey: "title",
    header: () => <span className="pl-5">{m.monitor_incident()}</span>,
    cell: ({ row }) => (
      <div className="min-w-0 pl-5">
        <p className="truncate font-medium">{row.original.title}</p>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {row.original.body ?? m.incident_no_summary_short()}
        </p>
      </div>
    ),
    size: 360,
  },
  {
    accessorKey: "status",
    header: m.common_status(),
    cell: ({ row }) => <IncidentStatusBadge status={row.original.status} />,
    size: 120,
  },
  {
    accessorKey: "openedAt",
    header: m.monitor_opened(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDateTime(row.original.openedAt)}
      </span>
    ),
    size: 240,
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
    size: 120,
  },
  {
    accessorKey: "closedAt",
    header: () => <span className="pr-5">{m.monitor_resolved()}</span>,
    cell: ({ row }) => (
      <span className="pr-5 text-muted-foreground">
        {formatDateTime(row.original.closedAt)}
      </span>
    ),
    size: 240,
  },
];
