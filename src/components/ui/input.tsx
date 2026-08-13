import * as React from "react"

import { cn } from "@/lib/utils"
import { lxControlBox } from "@/components/ui/lx"

/**
 * Spec §4. One control geometry: 36px tall, 12px inline padding, 8px radius.
 * `date`, `time` and `datetime-local` inherit it, which is what stops a form
 * row from rendering three different heights.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        lxControlBox,
        "h-[36px] px-[12px] py-0 leading-[1.2]",
        // WebKit centres and pads the value of a date/time field by default,
        // which is what threw the add-event row out of alignment.
        "[&::-webkit-date-and-time-value]:m-0 [&::-webkit-date-and-time-value]:text-left",
        "file:mr-[10px] file:inline-flex file:h-[24px] file:border-0 file:bg-transparent file:text-[12.5px] file:[font-weight:550] file:[color:var(--lx-ink)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
