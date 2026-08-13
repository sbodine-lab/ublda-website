"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { lxFocus, lxTransition } from "@/components/ui/lx"
import { CheckIcon } from "lucide-react"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-[16px] shrink-0 items-center justify-center rounded-[4px]",
        "border [border-color:var(--lx-border)] [background-color:var(--lx-surface)]",
        "after:absolute after:-inset-x-3 after:-inset-y-2",
        "data-[state=checked]:[border-color:var(--lx-navy)] data-[state=checked]:[background-color:var(--lx-navy)] data-[state=checked]:[color:#ffffff]",
        "data-[state=indeterminate]:[border-color:var(--lx-navy)] data-[state=indeterminate]:[background-color:var(--lx-navy)] data-[state=indeterminate]:[color:#ffffff]",
        "disabled:cursor-not-allowed disabled:opacity-[0.55] group-has-disabled/field:opacity-[0.55]",
        "aria-invalid:[border-color:#b42318]",
        lxTransition,
        lxFocus,
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-[12px]"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
