import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-all duration-200 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-ink text-white shadow-pill hover:bg-ink/85",
        destructive: "bg-negative text-white hover:bg-negative/90 shadow-pill",
        outline: "border border-ink/[0.14] bg-white/70 text-ink hover:bg-white",
        secondary: "bg-ink/[0.06] text-ink hover:bg-ink/[0.10]",
        ghost: "text-text-secondary hover:bg-ink/[0.05] hover:text-ink",
        link: "text-mint underline-offset-4 hover:underline",
        liquid: "bg-gradient-to-r from-mint to-accent-2 text-white shadow-pill hover:opacity-95",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-full px-4",
        lg: "h-11 rounded-full px-7",
        xl: "h-12 rounded-full px-9 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
