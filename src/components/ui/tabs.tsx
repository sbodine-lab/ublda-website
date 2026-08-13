import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { LayoutGroup, motion, useReducedMotion } from "framer-motion"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { lxFocus } from "@/components/ui/lx"

/**
 * Spec §7.1. One tab bar for the whole app, with a single underline that
 * slides between triggers.
 *
 * The shadcn default shipped a pill background, a shadow and an animated
 * `after:` underline behind Tailwind's `data-active:` variant, which compiles
 * to the literal attribute `[data-active]`. Radix emits `data-state="active"`,
 * so none of it ever matched: the only reason an active tab was visible was a
 * hand-written `box-shadow: inset 0 -2px` in app CSS, with no transition. The
 * indicator below is a `layoutId` element, so React moves one node between
 * triggers and framer-motion interpolates the gap.
 */
type TabsContextValue = { layoutId: string; value?: string }

const TabsContext = React.createContext<TabsContextValue>({ layoutId: "" })

function Tabs({
  className,
  orientation = "horizontal",
  value,
  defaultValue,
  onValueChange,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const layoutId = React.useId()
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  // Read straight through in the controlled case so the indicator never lags
  // the panel by a frame.
  const current = value ?? uncontrolledValue

  const handleValueChange = React.useCallback(
    (next: string) => {
      setUncontrolledValue(next)
      onValueChange?.(next)
    },
    [onValueChange]
  )

  const context = React.useMemo<TabsContextValue>(
    () => ({ layoutId, value: current }),
    [layoutId, current]
  )

  return (
    <TabsContext.Provider value={context}>
      <LayoutGroup id={layoutId}>
        <TabsPrimitive.Root
          data-slot="tabs"
          orientation={orientation}
          value={value}
          defaultValue={defaultValue}
          onValueChange={handleValueChange}
          className={cn(
            "group/tabs flex gap-[16px] data-[orientation=horizontal]:flex-col",
            className
          )}
          {...props}
        />
      </LayoutGroup>
    </TabsContext.Provider>
  )
}

const tabsListVariants = cva(
  [
    "group/tabs-list relative inline-flex w-fit items-center gap-[4px] bg-transparent",
    "border-b [border-color:var(--lx-hairline)]",
    "group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
    "group-data-[orientation=vertical]/tabs:items-stretch",
    "group-data-[orientation=vertical]/tabs:border-b-0 group-data-[orientation=vertical]/tabs:border-r",
  ].join(" "),
  {
    variants: {
      // The pill variant is gone — there is one tab bar in the app now. The
      // prop stays so existing `variant="line"` call sites keep type-checking.
      variant: { default: "", line: "" },
    },
    defaultVariants: { variant: "line" },
  }
)

function TabsList({
  className,
  variant = "line",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  children,
  value,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const { layoutId, value: current } = React.useContext(TabsContext)
  const reduceMotion = useReducedMotion()
  const active = current === value

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      value={value}
      className={cn(
        "lx-tab relative inline-flex h-[36px] shrink-0 items-center justify-center",
        "rounded-none border-0 bg-transparent px-[12px] whitespace-nowrap",
        "[font-family:inherit] text-[13px] [font-weight:550] leading-[1.2] [color:var(--lx-muted)]",
        "transition-[color] duration-[140ms] ease-[var(--lx-ease)]",
        "hover:[color:var(--lx-ink)] data-[state=active]:[color:var(--lx-ink)]",
        "disabled:pointer-events-none disabled:opacity-[0.55]",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[16px]",
        lxFocus,
        className
      )}
      {...props}
    >
      {/* Active is signalled by ink colour and the sliding underline, not by a
          heavier label. Weight-shifting the active tab reflows its neighbours
          mid-travel; the earlier fix for that rendered a hidden duplicate of
          every label, which put "OpenOpen" in the trigger's text content. */}
      <span className="lx-tab__label pointer-events-none flex items-center justify-center gap-[6px]">
        {children}
      </span>

      {active ? (
        <motion.span
          layoutId={`${layoutId}-indicator`}
          className={cn(
            "lx-tab__indicator pointer-events-none absolute inset-x-0 -bottom-px h-[2px] rounded-[2px]",
            "[background-color:var(--lx-navy)]",
            "group-data-[orientation=vertical]/tabs:inset-x-auto group-data-[orientation=vertical]/tabs:-right-px",
            "group-data-[orientation=vertical]/tabs:inset-y-0 group-data-[orientation=vertical]/tabs:h-auto group-data-[orientation=vertical]/tabs:w-[2px]"
          )}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 420, damping: 38, mass: 0.9 }
          }
        />
      ) : null}
    </TabsPrimitive.Trigger>
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-[13px] outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
