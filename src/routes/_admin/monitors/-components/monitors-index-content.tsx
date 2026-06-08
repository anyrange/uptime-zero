import { Link } from "@tanstack/react-router";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  Columns3,
  Download,
  Ellipsis,
  ExternalLink,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import type { MonitorRecord } from "@/types";

import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { formatDurationMs, formatRelativeDateTime } from "@/lib/formatters";
import {
  useDeleteMonitorMutation,
  useDeleteMonitorsMutation,
} from "@/lib/queries/monitors";
import {
  type MonitorImportPayload,
  useImportMonitorsMutation,
} from "@/lib/queries/settings";
import { m } from "@/paraglide/messages.js";

import { displayMonitorTarget } from "../-components/monitor-workspace-page";

export function MonitorsIndexContent({
  monitors,
  openIncidentCount,
  slowestP95ResponseMs,
}: {
  monitors: MonitorRecord[];
  openIncidentCount: number;
  slowestP95ResponseMs: number | null;
}) {
  const activeCount = monitors.filter((monitor) => monitor.active === 1).length;
  const pausedCount = monitors.length - activeCount;
  const downCount = monitors.filter(
    (monitor) => monitor.lastStatus === "down",
  ).length;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <MonitorSummaryCard>
          <CardDescription>{m.monitor_total()}</CardDescription>
          <CardTitle>{monitors.length}</CardTitle>
        </MonitorSummaryCard>
        <MonitorSummaryCard>
          <CardDescription>{m.common_active()}</CardDescription>
          <CardTitle>{activeCount}</CardTitle>
        </MonitorSummaryCard>
        <MonitorSummaryCard>
          <CardDescription>{m.common_paused()}</CardDescription>
          <CardTitle>{pausedCount}</CardTitle>
        </MonitorSummaryCard>
        <MonitorSummaryCard>
          <CardDescription>{m.common_down()}</CardDescription>
          <CardTitle>{downCount}</CardTitle>
        </MonitorSummaryCard>
        <MonitorSummaryCard>
          <CardDescription>{m.monitor_open_incidents()}</CardDescription>
          <CardTitle>{openIncidentCount}</CardTitle>
        </MonitorSummaryCard>
        <MonitorSummaryCard>
          <CardDescription>{m.monitor_slowest_p95()}</CardDescription>
          <CardTitle>{formatDurationMs(slowestP95ResponseMs)}</CardTitle>
        </MonitorSummaryCard>
      </div>

      <MonitorDataTable monitors={monitors} />
    </div>
  );
}

function MonitorDataTable({ monitors }: { monitors: MonitorRecord[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [importError, setImportError] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const importMonitors = useImportMonitorsMutation();
  const removeSelected = useDeleteMonitorsMutation();

  const table = useReactTable({
    data: monitors,
    columns: monitorColumns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: {
      columnFilters,
      columnVisibility,
      rowSelection,
      sorting,
    },
  });

  const selectedMonitors = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original);
  const selectedMonitorIds = selectedMonitors.map((monitor) => monitor.id);

  async function handleImport(file: File | undefined) {
    if (!file) return;
    setImportError(null);
    try {
      const payload = JSON.parse(await file.text()) as MonitorImportPayload;
      await importMonitors.mutateAsync(payload);
      setRowSelection({});
    } catch (error) {
      setImportError(errorMessage(error));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <AlertDialog onOpenChange={setBulkDeleteOpen} open={bulkDeleteOpen}>
      <div className="grid gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Input
            className="md:max-w-xs"
            onChange={(event) =>
              table.getColumn("name")?.setFilterValue(event.target.value)
            }
            placeholder={m.monitor_filter_placeholder()}
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          />
          <div className="flex flex-wrap items-center gap-2 md:ml-auto">
            {selectedMonitors.length > 0 ? (
              <>
                <Button
                  onClick={() => exportMonitors(selectedMonitors)}
                  type="button"
                  variant="outline"
                >
                  <Download className="size-4" />
                  Export selected
                </Button>
                <Button
                  onClick={() => setBulkDeleteOpen(true)}
                  type="button"
                  variant="destructive"
                >
                  <Trash2 className="size-4" />
                  Delete selected
                </Button>
              </>
            ) : null}
            <input
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) =>
                void handleImport(event.currentTarget.files?.[0])
              }
              ref={fileInputRef}
              type="file"
            />
            <Button
              disabled={importMonitors.isPending}
              onClick={() => fileInputRef.current?.click()}
              type="button"
              variant="outline"
            >
              <Upload className="size-4" />
              Import
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline">
                  <Columns3 className="size-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {m.monitor_toggle_columns()}
                </DropdownMenuLabel>
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      checked={column.getIsVisible()}
                      key={column.id}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {columnLabel(column.id)}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {importMonitors.data?.imported ? (
          <p className="text-sm text-emerald-300">
            {m.monitor_imported_count({ count: importMonitors.data.imported })}
          </p>
        ) : null}
        {importError || importMonitors.error ? (
          <p className="text-sm text-rose-300">
            {importError ?? errorMessage(importMonitors.error)}
          </p>
        ) : null}
        {removeSelected.error ? (
          <p className="text-sm text-rose-300">
            {errorMessage(removeSelected.error)}
          </p>
        ) : null}

        <DataTable
          columnsLength={monitorColumns.length}
          empty={
            monitors.length === 0
              ? m.monitor_no_monitors()
              : m.monitor_no_filter_matches()
          }
          table={table}
        />

        <div className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center">
          <p className="flex-1">
            {m.monitor_selection_summary({
              selected: selectedMonitors.length,
              total: table.getFilteredRowModel().rows.length,
            })}
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              size="sm"
              type="button"
              variant="outline"
            >
              {m.common_previous()}
            </Button>
            <span>
              {m.monitor_page_summary({
                page: table.getState().pagination.pageIndex + 1,
                total: table.getPageCount(),
              })}
            </span>
            <Button
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              size="sm"
              type="button"
              variant="outline"
            >
              {m.common_next()}
            </Button>
          </div>
        </div>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {m.monitor_delete_selected_title()}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {m.monitor_delete_selected_description({
                count: selectedMonitors.length,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeSelected.isPending}>
              {m.common_cancel()}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={removeSelected.isPending}
              onClick={(event) => {
                event.preventDefault();
                void (async () => {
                  try {
                    await removeSelected.mutateAsync(selectedMonitorIds);
                    setRowSelection({});
                    setBulkDeleteOpen(false);
                  } catch {
                    // The mutation error is rendered in the toolbar after close.
                  }
                })();
              }}
            >
              {removeSelected.isPending
                ? m.monitor_deleting()
                : m.monitor_delete_selected()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </div>
    </AlertDialog>
  );
}

const monitorColumns: ColumnDef<MonitorRecord>[] = [
  {
    id: "select",
    enableHiding: false,
    enableSorting: false,
    header: ({ table }) => (
      <Checkbox
        aria-label={m.monitor_select_all_page()}
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label={m.monitor_select_row({ name: row.original.name })}
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
      />
    ),
  },
  {
    accessorKey: "name",
    filterFn: (row, columnId, filterValue) => {
      const query = String(filterValue).toLowerCase().trim();
      if (!query) return true;
      const monitor = row.original;
      return [
        row.getValue(columnId),
        monitor.kind,
        monitor.lastStatus,
        displayMonitorTarget(monitor),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    },
    header: ({ column }) => (
      <SortableHeader
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        {m.monitor_monitor()}
      </SortableHeader>
    ),
    cell: ({ row }) => {
      const monitor = row.original;
      return (
        <Link
          className="flex items-center gap-2"
          params={{ monitorId: monitor.id }}
          to="/monitors/$monitorId"
        >
          <p className="font-medium">{monitor.name}</p>
          {monitor.assertions.length > 0 ? (
            <Badge variant="outline">
              {m.monitor_assertion_count({
                count: monitor.assertions.length,
              })}
            </Badge>
          ) : null}
        </Link>
      );
    },
  },
  {
    accessorKey: "kind",
    header: ({ column }) => (
      <SortableHeader
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        {m.common_type()}
      </SortableHeader>
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.kind.toUpperCase()}
      </span>
    ),
  },
  {
    accessorKey: "lastStatus",
    header: ({ column }) => (
      <SortableHeader
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        {m.common_status()}
      </SortableHeader>
    ),
    cell: ({ row }) => <StatusBadge status={row.original.lastStatus} />,
  },
  {
    id: "target",
    accessorFn: (monitor) => displayMonitorTarget(monitor),
    header: m.monitor_target(),
    cell: ({ row }) => (
      <span className="block max-w-[320px] truncate text-muted-foreground">
        {displayMonitorTarget(row.original)}
      </span>
    ),
  },
  {
    accessorKey: "intervalSec",
    header: ({ column }) => (
      <SortableHeader
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        {m.common_interval()}
      </SortableHeader>
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.intervalSec}s</span>
    ),
  },
  {
    accessorKey: "lastDurationMs",
    header: ({ column }) => (
      <SortableHeader
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        {m.monitor_last_latency()}
      </SortableHeader>
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDurationMs(row.original.lastDurationMs)}
      </span>
    ),
  },
  {
    accessorKey: "lastCheckedAt",
    header: ({ column }) => (
      <SortableHeader
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        {m.monitor_last_checked()}
      </SortableHeader>
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatRelativeDateTime(row.original.lastCheckedAt)}
      </span>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    enableSorting: false,
    header: () => <span className="sr-only">{m.common_actions()}</span>,
    cell: ({ row }) => (
      <div className="text-right">
        <MonitorRowActions monitor={row.original} />
      </div>
    ),
  },
];

function SortableHeader({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      className="-ml-3 h-8 px-3"
      onClick={onClick}
      type="button"
      variant="ghost"
    >
      {children}
      <ArrowUpDown className="size-4" />
    </Button>
  );
}

function columnLabel(id: string) {
  return id === "lastStatus"
    ? m.common_status()
    : id === "intervalSec"
      ? m.common_interval()
      : id === "lastDurationMs"
        ? m.monitor_column_last_latency()
        : id === "lastCheckedAt"
          ? m.monitor_column_last_checked()
          : id[0].toUpperCase() + id.slice(1);
}

function exportMonitors(monitors: MonitorRecord[]) {
  const exported = {
    kind: "uptime-monitor-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    monitors: monitors.map((monitor) => ({
      name: monitor.name,
      kind: monitor.kind,
      target: monitor.target,
      intervalSec: monitor.intervalSec,
      timeoutMs: monitor.timeoutMs,
      retries: monitor.retries,
      assertions: monitor.assertions,
      active: monitor.active === 1,
    })),
  };
  const blob = new Blob([JSON.stringify(exported, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `uptime-monitors-selected-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function errorMessage(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
    ? error.message
    : m.monitor_import_failed();
}

function MonitorSummaryCard({ children }: { children: ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>{children}</CardHeader>
    </Card>
  );
}

function MonitorRowActions({ monitor }: { monitor: MonitorRecord }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const remove = useDeleteMonitorMutation(monitor.id);

  return (
    <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={m.monitor_open_actions({ name: monitor.name })}
            size="icon-sm"
            variant="ghost"
          >
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem asChild>
            <Link params={{ monitorId: monitor.id }} to="/monitors/$monitorId">
              <ExternalLink className="size-4" />
              Open
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              params={{ monitorId: monitor.id }}
              to="/monitors/$monitorId/edit"
            >
              <Pencil className="size-4" />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setConfirmOpen(true);
            }}
            variant="destructive"
          >
            <Trash2 className="size-4" />
            {m.common_delete()}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{m.monitor_delete_title()}</AlertDialogTitle>
          <AlertDialogDescription>
            {m.monitor_delete_description({ name: monitor.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>
            {m.common_cancel()}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {remove.isPending ? m.monitor_deleting() : m.common_delete()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
