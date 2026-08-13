import * as React from "react"

import { cn } from "@/lib/utils"
import "@/components/ui/primitives.css"

/**
 * Spec §8.5. One container: opaque white, hairline border, 12px radius,
 * `--lx-shadow-sm`, 20px padding, 52px header band. No glass, no ring.
 */
function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col overflow-hidden rounded-[var(--lx-radius-surface)]",
        "border [border-color:var(--lx-hairline)] [background-color:var(--lx-surface)] [box-shadow:var(--lx-shadow-sm)]",
        "[font-family:inherit] text-[13px] [color:var(--lx-ink)] [--card-spacing:20px]",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header grid min-h-[52px] auto-rows-min items-center gap-x-[12px] px-[20px]",
        "border-b [border-color:var(--lx-hairline)]",
        "has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "[font-family:inherit] text-[15px] leading-[1.2] [font-weight:640] [letter-spacing:-0.005em] [color:var(--lx-ink)]",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-[13px] leading-[1.45] [color:var(--lx-muted)]", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-center justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("p-[20px]", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center gap-[8px] p-[20px] border-t [border-color:var(--lx-hairline)]",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
