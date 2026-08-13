import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"
import { lxFocus, lxInvalid, lxTransition } from "@/components/ui/lx"

/**
 * Spec §5. Four sizes, five variants, one focus treatment. Buttons change
 * background on hover and nothing else — no lift, no scale, no shadow bloom.
 */
const buttonVariants = cva(
  [
    "group/button inline-flex shrink-0 items-center justify-center select-none whitespace-nowrap",
    // `[border-color:transparent]`, not `border-transparent`: the variants set
    // their border with an arbitrary property, and tailwind-merge only dedupes
    // against the same key. Mixing the two forms left `border-transparent`
    // winning the cascade, so `outline` buttons rendered with no visible edge.
    "border [border-color:transparent] bg-clip-padding [font-family:inherit] leading-[1.2]",
    "disabled:pointer-events-none disabled:opacity-[0.55]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[16px]",
    // Leading/trailing icons tighten the inset they sit against.
    "has-data-[icon=inline-start]:pl-[10px] has-data-[icon=inline-end]:pr-[10px]",
    lxTransition,
    lxFocus,
    lxInvalid,
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "[background-color:var(--lx-navy)] [color:#ffffff] hover:[background-color:var(--lx-navy-strong)] active:[background-color:var(--lx-navy-strong)]",
        outline:
          "[background-color:var(--lx-surface)] [border-color:var(--lx-border)] [color:var(--lx-ink)] hover:[background-color:var(--lx-canvas)] aria-expanded:[background-color:var(--lx-canvas)]",
        ghost:
          "bg-transparent [color:var(--lx-muted)] hover:[background-color:var(--lx-hover-wash)] hover:[color:var(--lx-ink)] aria-expanded:[background-color:var(--lx-hover-wash)] aria-expanded:[color:var(--lx-ink)]",
        destructive:
          "[background-color:#fef3f2] [color:#b42318] hover:[background-color:#fee4e2]",
        link: "[color:var(--lx-navy)] underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-[36px] gap-[6px] rounded-[var(--lx-radius-control)] px-[14px] text-[13px] [font-weight:550]",
        xs: "h-[26px] gap-[4px] rounded-[6px] px-[8px] text-[11.5px] [font-weight:560] [&_svg:not([class*='size-'])]:size-[14px]",
        sm: "h-[32px] gap-[6px] rounded-[var(--lx-radius-control)] px-[12px] text-[12.5px] [font-weight:550] [&_svg:not([class*='size-'])]:size-[14px]",
        lg: "h-[40px] gap-[8px] rounded-[var(--lx-radius-control)] px-[18px] text-[13.5px] [font-weight:550]",
        icon: "size-[36px] rounded-[var(--lx-radius-control)]",
        "icon-xs":
          "size-[24px] rounded-[6px] [&_svg:not([class*='size-'])]:size-[14px]",
        "icon-sm":
          "size-[28px] rounded-[var(--lx-radius-control)] [&_svg:not([class*='size-'])]:size-[14px]",
        "icon-lg": "size-[40px] rounded-[var(--lx-radius-control)]",
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
