"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-ink/[0.06] text-ink",
        secondary: "border-ink/[0.12] bg-transparent text-text-secondary",
        destructive: "border-negative/30 bg-negative/15 text-negative",
        outline: "border-ink/[0.14] bg-transparent text-text-secondary",
        mint: "border-mint/30 bg-mint/15 text-mint",
        softBlue: "border-transparent bg-[#dbe7ff] text-[#3b5bdb]",
        softGreen: "border-transparent bg-emerald-100 text-emerald-700",
        softAmber: "border-transparent bg-amber-100 text-amber-700",
        softRed: "border-transparent bg-red-100 text-red-600",
        softGray: "border-transparent bg-ink/[0.06] text-text-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
