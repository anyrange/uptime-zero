import { Link } from "@tanstack/react-router";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type { HeartbeatPage, HeartbeatRecord } from "@/types";

import { DataTable } from "@/components/data-table";
import { LiveTime } from "@/components/live-time";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatDurationMs } from "@/lib/formatters";
import { getMonitorLogsPageRange } from "@/lib/monitor-logs";
import { m } from "@/paraglide/messages.js";

export function MonitorLogsTable({
  monitorId,
  pageData,
}: {
  monitorId: string;
  pageData: HeartbeatPage;
}) {
  const table = useReactTable({
    data: pageData.heartbeats,
    columns: monitorLogColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DataTable
      columnsLength={monitorLogColumns.length}
      empty={m.monitor_no_heartbeat_logs()}
      footer={
        <MonitorLogsPagination monitorId={monitorId} pageData={pageData} />
      }
      table={table}
    />
  );
}

const monitorLogColumns: ColumnDef<HeartbeatRecord>[] = [
  {
    accessorKey: "createdAt",
    header: () => <span className="pl-5">{m.monitor_timestamp()}</span>,
    cell: ({ row }) => (
      <LiveTime
        className="pl-5 text-muted-foreground"
        mode="absolute"
        value={row.original.createdAt}
      />
    ),
    size: 220,
  },
  {
    accessorKey: "status",
    header: m.common_status(),
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
    size: 120,
  },
  {
    accessorKey: "statusCode",
    header: m.monitor_code(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.statusCode ?? m.common_not_available()}
      </span>
    ),
    size: 80,
  },
  {
    accessorKey: "durationMs",
    header: m.monitor_latency(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDurationMs(row.original.durationMs)}
      </span>
    ),
    size: 100,
  },
  {
    accessorKey: "source",
    header: m.monitor_source(),
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.source}</span>
    ),
    size: 100,
  },
  {
    accessorKey: "error",
    header: () => <span className="pr-5">{m.monitor_details()}</span>,
    cell: ({ row }) => (
      <span className="block truncate pr-5 text-sm text-muted-foreground">
        {row.original.error ?? m.common_healthy()}
      </span>
    ),
    size: 260,
  },
];

function MonitorLogsPagination({
  monitorId,
  pageData,
}: {
  monitorId: string;
  pageData: HeartbeatPage;
}) {
  const range = getMonitorLogsPageRange({
    page: pageData.page,
    pageSize: pageData.pageSize,
    total: pageData.total,
    resultCount: pageData.heartbeats.length,
  });
  const previousPage = pageData.page - 1;
  const nextPage = pageData.page + 1;

  return (
    <div className="flex flex-col gap-3 border-t border-border/70 px-5 py-4 text-sm md:flex-row md:items-center md:justify-between">
      <p className="text-muted-foreground">
        {range == null
          ? m.monitor_showing_zero_checks()
          : m.monitor_showing_check_range({
              start: range.start,
              end: range.end,
              total: pageData.total,
            })}
      </p>
      <div className="flex items-center gap-2">
        {pageData.hasPreviousPage ? (
          <Button asChild size="sm" variant="outline">
            <Link
              params={{ monitorId }}
              search={{ page: previousPage }}
              to="/monitors/$monitorId/logs"
            >
              {m.common_previous()}
            </Link>
          </Button>
        ) : (
          <Button disabled size="sm" variant="outline">
            {m.common_previous()}
          </Button>
        )}
        <span className="min-w-20 text-center text-muted-foreground">
          {m.monitor_page_summary({
            page: pageData.page,
            total: pageData.totalPages,
          })}
        </span>
        {pageData.hasNextPage ? (
          <Button asChild size="sm" variant="outline">
            <Link
              params={{ monitorId }}
              search={{ page: nextPage }}
              to="/monitors/$monitorId/logs"
            >
              {m.common_next()}
            </Link>
          </Button>
        ) : (
          <Button disabled size="sm" variant="outline">
            {m.common_next()}
          </Button>
        )}
      </div>
    </div>
  );
}
