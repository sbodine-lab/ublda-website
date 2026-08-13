import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"
import { lxFocus, lxTransition } from "@/components/ui/lx"

/**
 * Spec §2.2, §8. The status chip — and the only place `--lx-radius-pill` is
 * allowed. Colours come from the status table; `default` reads as active,
 * `secondary` as closed or complete.
 */
const badgeVariants = cva(
  [
    "group/badge inline-flex h-[20px] w-fit shrink-0 items-center justify-center gap-[4px]",
    // Arbitrary-property form so tailwind-merge dedupes it against the
    // variants' own `[border-color:…]` (see button.tsx).
    "overflow-hidden rounded-[var(--lx-radius-pill)] border [border-color:transparent] px-[8px]",
    "[font-family:inherit] text-[11.5px] [font-weight:560] [letter-spacing:0.01em] leading-[1.2] whitespace-nowrap",
    "has-data-[icon=inline-start]:pl-[6px] has-data-[icon=inline-end]:pr-[6px]",
    "[&>svg]:pointer-events-none [&>svg]:size-[12px]!",
    lxTransition,
    lxFocus,
  ].join(" "),
  {
    variants: {
      variant: {
        default: "[background-color:#eff4ff] [color:#175cd3]",
        secondary: "[background-color:#f2f4f7] [color:#475467]",
        destructive: "[background-color:#fef3f2] [color:#b42318]",
        outline:
          "[border-color:var(--lx-border)] [color:var(--lx-muted)] [background-color:transparent]",
        ghost: "[color:var(--lx-muted)] hover:[background-color:var(--lx-hover-wash)]",
        link: "[color:var(--lx-navy)] underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
