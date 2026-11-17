import { cn } from "@/shared/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-[2px] bg-linear-to-r from-surface-2 via-surface-3 to-surface-2 bg-size-[200%_100%] motion-safe:animate-skeleton-sheen",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
