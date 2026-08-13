import * as React from "react"

import { cn } from "@/lib/utils"
import { lxControlBox } from "@/components/ui/lx"

/** Spec §4. Same box as `Input`, 88px minimum, 10px block padding. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        lxControlBox,
        "field-sizing-content block min-h-[88px] resize-y px-[12px] py-[10px] leading-[1.45]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
