"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Search, Filter, ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";
import { forwardRef } from "react";

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface Action<T> {
  label: string;
  onClick: (row: T) => void;
  variant?: "default" | "destructive" | "outline" | "ghost";
  icon?: any;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  rowKey: keyof T | ((row: T) => string);
  onRowClick?: (row: T) => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
  searchable?: boolean;
  searchPlaceholder?: string;
  filters?: Array<{
    key: string;
    label: string;
    options: Array<{ value: string; label: string }>;
    value: string;
    onChange: (value: string) => void;
  }>;
  actions?: Action<T>[];
}

function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyMessage = "暂无数据",
  rowKey,
  onRowClick,
  pagination,
  searchable = false,
  searchPlaceholder = "搜索...",
  filters = [],
  actions = [],
}: DataTableProps<T>) {
  const getRowKey = (row: T) => (typeof rowKey === "function" ? rowKey(row) : String(row[rowKey]));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-white/10 bg-glass-strong p-4">
          <div className="h-10 w-full animate-pulse rounded bg-white/5" />
          <div className="h-10 w-full animate-pulse rounded bg-white/5 mt-4" />
          <div className="h-10 w-full animate-pulse rounded bg-white/5 mt-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          {searchable && (
            <div className="relative max-sm:w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={searchPlaceholder}
                className="pl-10 w-[280px]"
              />
            </div>
          )}
          {filters.map((filter) => (
            <Select key={filter.key} value={filter.value} onValueChange={filter.onChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                {filter.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-white/10 bg-glass-strong overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    "font-medium text-muted-foreground",
                    col.className
                  )}
                >
                  {col.header}
                </TableHead>
              ))}
              {actions.length > 0 && (
                <TableHead className="w-32 text-right">操作</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (actions.length > 0 ? 1 : 0)}
                  className="text-center py-12 text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow
                  key={getRowKey(row)}
                  className={cn(
                    "transition-colors hover:bg-white/5",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => {
                    const val = row[col.key as keyof T];
                    let displayValue: string;
                    if (col.render) {
                      displayValue = col.render(row) as string;
                    } else if (typeof val === 'bigint') {
                      displayValue = val.toString();
                    } else {
                      displayValue = String(val ?? "");
                    }
                    return (
                      <TableCell key={col.key} className={cn(col.className)}>
                        {displayValue}
                      </TableCell>
                    );
                  })}
                  {actions.length > 0 && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {actions.map((action, idx) => (
                          <Button
                            key={idx}
                            variant={action.variant || "ghost"}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              action.onClick(row);
                            }}
                          >
                            {action.icon}
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && (
        <Pagination
          currentPage={pagination.page}
          totalPages={Math.ceil(pagination.total / pagination.pageSize)}
          onPageChange={pagination.onPageChange}
          className="justify-center"
        />
      )}
    </div>
  );
}

DataTable.displayName = "DataTable";

export { DataTable };
export type { Column, DataTableProps };