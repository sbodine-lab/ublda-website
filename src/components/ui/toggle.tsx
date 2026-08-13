import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Toggle as TogglePrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { lxFocus, lxTransition } from "@/components/ui/lx"

const toggleVariants = cva(
  [
    "group/toggle inline-flex items-center justify-center gap-[6px] whitespace-nowrap select-none",
    "[font-family:inherit] leading-[1.2] [color:var(--lx-muted)] border [border-color:transparent]",
    "hover:[background-color:var(--lx-hover-wash)] hover:[color:var(--lx-ink)]",
    "data-[state=on]:[background-color:var(--lx-active-wash)] data-[state=on]:[color:var(--lx-navy)]",
    "disabled:pointer-events-none disabled:opacity-[0.55]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[16px]",
    lxTransition,
    lxFocus,
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "[border-color:var(--lx-border)] [background-color:var(--lx-surface)]",
      },
      size: {
        default:
          "h-[36px] min-w-[36px] rounded-[var(--lx-radius-control)] px-[12px] text-[13px] [font-weight:550]",
        sm: "h-[32px] min-w-[32px] rounded-[var(--lx-radius-control)] px-[10px] text-[12.5px] [font-weight:550] [&_svg:not([class*='size-'])]:size-[14px]",
        lg: "h-[40px] min-w-[40px] rounded-[var(--lx-radius-control)] px-[14px] text-[13.5px] [font-weight:550]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      data-variant={variant}
      data-size={size}
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
