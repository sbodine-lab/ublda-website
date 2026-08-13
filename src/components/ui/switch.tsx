import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { lxFocus, lxTransition } from "@/components/ui/lx"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent",
        "after:absolute after:-inset-x-3 after:-inset-y-2",
        "data-[size=default]:h-[20px] data-[size=default]:w-[34px] data-[size=sm]:h-[16px] data-[size=sm]:w-[26px]",
        "data-[state=checked]:[background-color:var(--lx-navy)] data-[state=unchecked]:[background-color:rgba(16,24,40,0.16)]",
        "data-disabled:cursor-not-allowed data-disabled:opacity-[0.55]",
        "aria-invalid:[border-color:#b42318]",
        lxTransition,
        lxFocus,
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full [background-color:#ffffff] [box-shadow:var(--lx-shadow-sm)] transition-transform duration-[120ms] ease-[var(--lx-ease)] group-data-[size=default]/switch:size-[16px] group-data-[size=sm]/switch:size-[12px] data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-[2px]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
