"use client";

import * as React from "react";
import {
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  type TableColumn,
} from "@vibe/core";
import { cn } from "@/lib/utils";

/* Vibe Table with a column-config API: define columns once (header +
   cell renderer), pass rows, and loading/empty/error states are handled. */

export interface DataTableColumn<Row> {
  id: string;
  title: string;
  width?: TableColumn["width"];
  loadingStateType?: TableColumn["loadingStateType"];
  render: (row: Row) => React.ReactNode;
}

export interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string | number;
  loading?: boolean;
  error?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyState?: React.ReactNode;
  errorState?: React.ReactNode;
  onRowClick?: (row: Row) => void;
  size?: "small" | "medium" | "large";
  className?: string;
}

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  emptyTitle = "Nothing here yet",
  emptyDescription = "Items will show up here once they are added.",
  emptyState,
  errorState,
  onRowClick,
  size = "medium",
  className,
}: DataTableProps<Row>) {
  const vibeColumns: TableColumn[] = columns.map(
    ({ id, title, width, loadingStateType }) => ({
      id,
      title,
      width,
      loadingStateType: loadingStateType ?? "medium-text",
    })
  );

  return (
    <Table
      className={cn("bg-white", className)}
      columns={vibeColumns}
      size={size}
      dataState={{ isLoading: loading, isError: error }}
      emptyState={
        <>{emptyState ?? <EmptyState title={emptyTitle} description={emptyDescription} />}</>
      }
      errorState={
        <>
          {errorState ?? (
            <EmptyState
              title="Something went wrong"
              description="We couldn't load this data. Try refreshing the page."
            />
          )}
        </>
      }
    >
      <TableHeader>
        {columns.map((col) => (
          <TableHeaderCell key={col.id} title={col.title} />
        ))}
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const cells = (
            <TableRow className={onRowClick ? "cursor-pointer" : undefined}>
              {columns.map((col) => (
                <TableCell key={col.id}>{col.render(row)}</TableCell>
              ))}
            </TableRow>
          );
          /* TableRow doesn't take DOM handlers; a display:contents wrapper
             adds row clicks without affecting the table layout. */
          return onRowClick ? (
            <div
              key={rowKey(row)}
              style={{ display: "contents" }}
              onClick={() => onRowClick(row)}
            >
              {cells}
            </div>
          ) : (
            <React.Fragment key={rowKey(row)}>{cells}</React.Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
