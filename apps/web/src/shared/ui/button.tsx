import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/shared/lib/utils"
import { Slot } from "radix-ui"

// Главная, второстепенная и опасная кнопки — со срезанными углами (утилита `chamfer` в globals.css):
// у них нет фона и скругления, форму рисуют псевдоэлементы. Иконочные и «призрачные» — круглые.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "chamfer chamfer-gold rounded-none text-[0.9375rem] font-semibold",
        outline: "chamfer chamfer-ghost rounded-none text-[0.9375rem] font-medium",
        secondary: "rounded-[3px] bg-secondary text-secondary-foreground hover:bg-surface-2",
        ghost: "hover:bg-surface-2 hover:text-foreground aria-expanded:bg-surface-2 aria-expanded:text-foreground",
        destructive: "chamfer chamfer-danger rounded-none text-[0.9375rem] font-semibold",
        link: "text-gold underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 gap-2 px-5",
        lg: "h-13 gap-2.5 px-6 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
