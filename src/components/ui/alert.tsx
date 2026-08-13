import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import "@/components/ui/primitives.css"

const alertVariants = cva(
  [
    "group/alert relative grid w-full gap-[4px] rounded-[var(--lx-radius-control)] border p-[16px]",
    "text-left [font-family:inherit] text-[13px] leading-[1.45]",
    "has-data-[slot=alert-action]:pr-[64px]",
    "has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-[10px]",
    "*:[svg]:row-span-2 *:[svg]:translate-y-[1px] *:[svg]:text-current *:[svg:not([class*='size-'])]:size-[16px]",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "[background-color:var(--lx-canvas)] [border-color:var(--lx-hairline)] [color:var(--lx-ink)]",
        destructive:
          "[background-color:#fef3f2] [border-color:rgba(180,35,24,0.16)] [color:#b42318] *:data-[slot=alert-description]:[color:#b42318]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "text-[13px] leading-[1.2] [font-weight:600] group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-[13px] leading-[1.45] [color:var(--lx-muted)] [&_a]:underline [&_a]:underline-offset-3",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-[12px] right-[12px]", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
