import * as React from "react"
import { Select as SelectPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import {
  lxControlBox,
  lxPopoverItem,
  lxPopoverMotion,
  lxPopoverSurface,
} from "@/components/ui/lx"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1", className)}
      {...props}
    />
  )
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

/**
 * Spec §4. The same box as `Input`, plus a chevron that rotates on open —
 * the only rotation in the app. `size="sm"` is for inline pickers in table
 * rows and nothing else.
 */
function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        lxControlBox,
        "group/select-trigger flex items-center justify-between gap-[8px] whitespace-nowrap select-none",
        // A default trigger fills its field so it lines up with `Input`; the
        // small one is an inline picker inside a table row and stays compact.
        "w-auto data-[size=default]:w-full data-[size=sm]:w-fit",
        "data-[size=default]:h-[36px] data-[size=default]:pl-[12px] data-[size=default]:pr-[10px]",
        "data-[size=sm]:h-[32px] data-[size=sm]:pl-[10px] data-[size=sm]:pr-[8px]",
        "data-placeholder:[color:var(--lx-faint)]",
        "*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-[6px]",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="pointer-events-none size-[16px] shrink-0 [color:var(--lx-faint)] transition-transform duration-150 ease-[var(--lx-ease)] group-data-[state=open]/select-trigger:rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

/**
 * `position` defaults to `popper` rather than Radix's `item-aligned`: the
 * item-aligned mode lays the list over the trigger and cannot be animated,
 * which is why every select in the app used to hard-cut open.
 */
function SelectContent({
  className,
  children,
  position = "popper",
  align = "start",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          lxPopoverSurface,
          lxPopoverMotion,
          "relative z-50 max-h-(--radix-select-content-available-height) min-w-[var(--radix-select-trigger-width)] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto p-[4px]",
          className
        )}
        position={position}
        align={align}
        sideOffset={position === "popper" ? sideOffset : undefined}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          data-position={position}
          className="data-[position=popper]:w-full data-[position=popper]:min-w-(--radix-select-trigger-width)"
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn(
        "px-[8px] py-[6px] text-[11.5px] [font-weight:560] [letter-spacing:0.01em] [color:var(--lx-faint)]",
        className
      )}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        lxPopoverItem,
        "py-[6px] pr-[30px] pl-[8px] *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-[8px]",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute right-[8px] flex size-[16px] items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="pointer-events-none size-[14px] [color:var(--lx-navy)]" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn(
        "pointer-events-none my-[4px] h-px [background-color:var(--lx-hairline)]",
        className
      )}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "z-10 flex cursor-default items-center justify-center [background-color:var(--lx-surface)] [color:var(--lx-faint)] [&_svg]:size-[16px]",
        className
      )}
      {...props}
    >
      <ChevronUpIcon />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "z-10 flex cursor-default items-center justify-center [background-color:var(--lx-surface)] [color:var(--lx-faint)] [&_svg]:size-[16px]",
        className
      )}
      {...props}
    >
      <ChevronDownIcon />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
