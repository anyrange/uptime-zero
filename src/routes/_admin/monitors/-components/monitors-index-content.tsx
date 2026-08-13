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
import { z } from "zod";

import type { MonitorRecord } from "@/types";

import { DataTable } from "@/components/data-table";
import { LiveTime } from "@/components/live-time";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { formatDurationMs } from "@/lib/formatters";
import { usePermissions } from "@/lib/hooks/use-permissions";
import {
  useDeleteMonitorMutation,
  useDeleteMonitorsMutation,
} from "@/lib/queries/monitors";
import {
  monitorImportSchema,
  useImportMonitorsMutation,
} from "@/lib/queries/settings";
import { m } from "@/paraglide/messages.js";

import { displayMonitorTarget } from "../-components/monitor-workspace-page";

export function MonitorsIndexContent({
  monitors,
  slowestP95ResponseMs,
}: {
  monitors: MonitorRecord[];
  slowestP95ResponseMs: number | null;
}) {
  const activeCount = monitors.filter((monitor) => monitor.active === 1).length;
  const pausedCount = monitors.length - activeCount;
  const downCount = monitors.filter(
    (monitor) => monitor.lastStatus === "down",
  ).length;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Card size="sm">
          <CardContent className="grid gap-1.5">
            <CardDescription>{m.monitor_total()}</CardDescription>
            <CardTitle>{monitors.length}</CardTitle>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="grid gap-1.5">
            <CardDescription>{m.common_active()}</CardDescription>
            <CardTitle>{activeCount}</CardTitle>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="grid gap-1.5">
            <CardDescription>{m.common_paused()}</CardDescription>
            <CardTitle>{pausedCount}</CardTitle>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="grid gap-1.5">
            <CardDescription>{m.common_down()}</CardDescription>
            <CardTitle>{downCount}</CardTitle>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="grid gap-1.5">
            <CardDescription>{m.monitor_slowest_p95()}</CardDescription>
            <CardTitle>{formatDurationMs(slowestP95ResponseMs)}</CardTitle>
          </CardContent>
        </Card>
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
  const { check, isReady } = usePermissions();
  const canDelete = isReady && check("monitor.delete");
  const canImport = isReady && check("monitor.import");

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
  const nameFilter = z
    .string()
    .catch("")
    .parse(table.getColumn("name")?.getFilterValue());

  async function handleImport(file: File | undefined) {
    if (!file) return;
    setImportError(null);
    try {
      const payload = monitorImportSchema.parse(JSON.parse(await file.text()));
      await importMonitors.mutateAsync(payload);
      setRowSelection({});
    } catch (error) {
      const parsedError = z.object({ message: z.string() }).safeParse(error);
      setImportError(
        parsedError.success
          ? parsedError.data.message
          : m.monitor_import_failed(),
      );
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
            value={nameFilter}
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
                  {m.monitor_export_selected()}
                </Button>
                {canDelete ? (
                  <Button
                    onClick={() => setBulkDeleteOpen(true)}
                    type="button"
                    variant="destructive"
                  >
                    <Trash2 className="size-4" />
                    {m.monitor_delete_selected()}
                  </Button>
                ) : null}
              </>
            ) : null}
            {canImport ? (
              <>
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
                  {m.monitor_import()}
                </Button>
              </>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline">
                  <Columns3 className="size-4" />
                  {m.monitor_columns()}
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
          <p className="text-sm text-primary">
            {m.monitor_imported_count({ count: importMonitors.data.imported })}
          </p>
        ) : null}
        {importError || importMonitors.error ? (
          <p className="text-sm text-destructive">
            {importError ?? errorMessage(importMonitors.error)}
          </p>
        ) : null}
        {removeSelected.error ? (
          <p className="text-sm text-destructive">
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
    size: 44,
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
          className="block max-w-[160px] truncate font-medium"
          params={{ monitorId: monitor.id }}
          to="/monitors/$monitorId"
        >
          {monitor.name}
        </Link>
      );
    },
    size: 190,
  },
  {
    accessorKey: "kind",
    size: 96,
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
    size: 96,
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
    cell: ({ row }) => {
      const target = displayMonitorTarget(row.original);
      return row.original.kind === "push" ? (
        <span className="block max-w-[180px] truncate text-muted-foreground">
          {target}
        </span>
      ) : (
        <a
          className="block max-w-[180px] truncate text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          href={target}
          rel="noreferrer"
          target="_blank"
        >
          {target}
        </a>
      );
    },
    size: 200,
  },
  {
    accessorKey: "intervalSec",
    size: 112,
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
    size: 140,
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
    size: 150,
    header: ({ column }) => (
      <SortableHeader
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        {m.monitor_last_checked()}
      </SortableHeader>
    ),
    cell: ({ row }) => (
      <LiveTime
        className="text-muted-foreground"
        value={row.original.lastCheckedAt}
      />
    ),
  },
  {
    id: "actions",
    size: 56,
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
      heartbeatMode: monitor.heartbeatMode,
      heartbeatCron: monitor.heartbeatCron,
      heartbeatGraceSec: monitor.heartbeatGraceSec,
      heartbeatTimezone: monitor.heartbeatTimezone,
      notificationGraceSec: monitor.notificationGraceSec,
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

function errorMessage(error: Error | null) {
  return error?.message || m.monitor_import_failed();
}

function MonitorRowActions({ monitor }: { monitor: MonitorRecord }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const remove = useDeleteMonitorMutation(monitor.id);
  const { check, isReady } = usePermissions();
  const canDelete = isReady && check("monitor.delete");

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
              {m.common_open()}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              params={{ monitorId: monitor.id }}
              to="/monitors/$monitorId/edit"
            >
              <Pencil className="size-4" />
              {m.common_edit()}
            </Link>
          </DropdownMenuItem>
          {canDelete ? (
            <>
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
            </>
          ) : null}
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
