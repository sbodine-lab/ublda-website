"use client"

import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import "@/components/ui/primitives.css"

/** Spec §2.4/§4: 12px / 600 / `--lx-muted`, sentence case, no transform. */
function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-[6px] select-none",
        "[font-family:inherit] text-[12px] leading-[1.2] [font-weight:600] [color:var(--lx-muted)] [text-transform:none]",
        "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-[0.55]",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-[0.55]",
        className
      )}
      {...props}
    />
  )
}

export { Label }
