"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  showPageSize?: boolean;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
  showPageSize = false,
  pageSize,
  onPageSizeChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <nav
      className={cn("flex items-center justify-center gap-1", className)}
      aria-label="Pagination"
    >
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        aria-label="Go to first page"
      >
        <ChevronsLeft className="w-4 h-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Go to previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>

      {pages.map((page, idx) =>
        typeof page === "number" ? (
          <Button
            key={idx}
            variant={page === currentPage ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(page)}
            aria-label={`Go to page ${page}`}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </Button>
        ) : (
          <span key={idx} className="px-2 text-muted-foreground">
            ...
          </span>
        )
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Go to next page"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        aria-label="Go to last page"
      >
        <ChevronsRight className="w-4 h-4" />
      </Button>

      {showPageSize && pageSize && onPageSizeChange && (
        <div className="ml-4 flex items-center gap-2 text-sm text-muted-foreground">
          <span>每页</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="border border-white/20 bg-glass-strong rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-mint"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span>条</span>
        </div>
      )}
    </nav>
  );
}

function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | string)[] = [1];

  if (currentPage > 3) {
    pages.push("...");
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < totalPages - 2) {
    pages.push("...");
  }

  pages.push(totalPages);

  return pages;
}