import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      role="status"
      aria-label="加载中"
      className={cn("rwa-skeleton", className)}
      {...props}
    />
  )
}

export { Skeleton }
