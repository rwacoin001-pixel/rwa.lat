"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-glass-strong text-white hover:bg-white/10",
        secondary: "border-white/20 bg-transparent text-white hover:bg-white/5",
        destructive: "border-red-500/50 bg-red-500/20 text-red-400 hover:bg-red-500/30",
        outline: "border-white/20 bg-transparent text-white",
        mint: "border-mint/50 bg-mint/20 text-mint hover:bg-mint/30",
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