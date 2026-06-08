import type { ReactNode } from "react";

import { flexRender, type Table as TanStackTable } from "@tanstack/react-table";

import { Card } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function DataTable<TData>({
  table,
  columnsLength,
  empty,
  footer,
}: {
  table: TanStackTable<TData>;
  columnsLength: number;
  empty: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden py-0">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow className="hover:bg-transparent" key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={columnSizeStyle(header.column.columnDef.size)}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                data-state={row.getIsSelected() ? "selected" : undefined}
                key={row.id}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    style={columnSizeStyle(cell.column.columnDef.size)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell className="p-4" colSpan={columnsLength}>
                <Empty className="min-h-32 border-0 bg-transparent">
                  <EmptyHeader>
                    <EmptyTitle>{empty}</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {footer}
    </Card>
  );
}

function columnSizeStyle(size: number | undefined) {
  return size ? { width: `${size}px`, maxWidth: `${size}px` } : undefined;
}
