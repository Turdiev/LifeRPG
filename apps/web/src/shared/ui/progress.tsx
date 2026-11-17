import * as React from "react"
import { cn } from "@/shared/lib/utils"
import { Progress as ProgressPrimitive } from "radix-ui"

/**
 * Золотая нить: заполненная часть светится. На паузе — холодная штриховка, у отменённого — тихий серый:
 * «не в работе» читается и формой, а не только цветом (docs/ux.md, «Цвета статусов»).
 */
function Progress({
  className,
  value,
  tone = "active",
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { tone?: "active" | "paused" | "cancelled" }) {
  return (
    // value передаётся в Root: без него Radix не ставит aria-valuenow, и скринридер не слышит процент.
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn("relative h-1.5 w-full border border-border bg-track", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "absolute inset-y-0 left-0 transition-[width] duration-300 motion-reduce:transition-none",
          tone === "paused" && "bg-[repeating-linear-gradient(135deg,var(--paused)_0_4px,transparent_4px_7px)]",
          tone === "cancelled" && "bg-muted-foreground/50",
          tone === "active" && "bg-linear-to-r from-gold-dim to-gold-bright shadow-[0_0_10px_var(--glow)]"
        )}
        style={{ width: `${value ?? 0}%` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
