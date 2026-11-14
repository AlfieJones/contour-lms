"use client";

import type { ReactNode } from "react";
import { Button } from "@lms/ui/button";
import { CardFrame, CardFrameFooter } from "@lms/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@lms/ui/pagination";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@lms/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@lms/ui/table";

export type DataTableColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  width?: number;
};

type DataTableProps<T extends { id: string }> = {
  label: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyMessage?: string;
  pagination?: {
    page: number;
    pageSize: number;
    hasMore: boolean;
    disabled?: boolean;
    onPageChange: (page: number) => void;
  };
};

export function DataTable<T extends { id: string }>({
  label,
  columns,
  rows,
  emptyMessage = "No results.",
  pagination,
}: DataTableProps<T>) {
  const start = rows.length
    ? ((pagination?.page ?? 1) - 1) * (pagination?.pageSize ?? rows.length) + 1
    : 0;
  const end = rows.length ? start + rows.length - 1 : 0;
  // These endpoints provide hasMore, not a total. Only offer pages known to exist.
  const ranges = pagination
    ? Array.from({ length: pagination.page }, (_, i) => {
        const page = i + 1;
        const rangeStart = i * pagination.pageSize + 1;
        const rangeEnd = page === pagination.page ? end : page * pagination.pageSize;
        return { value: page, label: rangeEnd ? `${rangeStart}–${rangeEnd}` : "0" };
      })
    : [];

  return (
    <CardFrame className="w-full min-w-0" aria-busy={pagination?.disabled}>
      <Table variant="card" aria-label={label} className="min-w-[560px]">
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={column.id}
                scope="col"
                className={column.className}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row) => (
              <TableRow key={row.id}>
                {columns.map((column) => (
                  <TableCell key={column.id} className={column.className}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <CardFrameFooter className="relative p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground"
            role="status"
          >
            <span>Viewing</span>
            {pagination && rows.length ? (
              <Select
                items={ranges}
                value={pagination.page}
                disabled={pagination.disabled}
                onValueChange={(value) => {
                  if (value !== null) pagination.onPageChange(value);
                }}
              >
                <SelectTrigger
                  aria-label={`${label} result range`}
                  className="w-fit min-w-0"
                  size="sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  <SelectGroup>
                    {ranges.map((range) => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectPopup>
              </Select>
            ) : (
              <strong className="font-medium text-foreground">
                {rows.length ? `${start}–${end}` : "0"}
              </strong>
            )}
            <span>results</span>
          </div>
          {pagination ? (
            <Pagination aria-label={`${label} pages`} className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    render={
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pagination.disabled || pagination.page <= 1}
                        onClick={() => pagination.onPageChange(pagination.page - 1)}
                      />
                    }
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    render={
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          pagination.disabled || !pagination.hasMore || pagination.page >= 10000
                        }
                        onClick={() => pagination.onPageChange(pagination.page + 1)}
                      />
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </div>
      </CardFrameFooter>
    </CardFrame>
  );
}
