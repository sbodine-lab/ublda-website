"use client"

import { useMemo } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import "@/components/ui/primitives.css"

/**
 * Spec §2.5. 6px from a label to its control, 16px between fields. Those two
 * numbers are the whole rhythm of a form.
 */
function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn("flex flex-col gap-[16px]", className)}
      {...props}
    />
  )
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "[font-family:inherit] [color:var(--lx-ink)]",
        "data-[variant=legend]:text-[15px] data-[variant=legend]:[font-weight:640] data-[variant=legend]:[letter-spacing:-0.005em]",
        "data-[variant=label]:text-[12px] data-[variant=label]:[font-weight:600] data-[variant=label]:[color:var(--lx-muted)]",
        className
      )}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-[16px]",
        className
      )}
      {...props}
    />
  )
}

const fieldVariants = cva(
  "group/field flex w-full data-[invalid=true]:[color:#b42318]",
  {
    variants: {
      orientation: {
        vertical: "flex-col gap-[6px] *:w-full [&>.sr-only]:w-auto",
        horizontal:
          "flex-row items-center gap-[12px] has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto",
        responsive:
          "flex-col gap-[6px] *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:gap-[12px] @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto",
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  }
)

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn(
        "group/field-content flex flex-1 flex-col gap-[2px] leading-[1.45]",
        className
      )}
      {...props}
    />
  )
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "group/field-label peer/field-label flex w-fit gap-[6px]",
        "group-data-[disabled=true]/field:opacity-[0.55]",
        // A label that wraps a whole field becomes a selectable card.
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col",
        "has-[>[data-slot=field]]:rounded-[var(--lx-radius-control)] has-[>[data-slot=field]]:border has-[>[data-slot=field]]:[border-color:var(--lx-border)]",
        "has-data-checked:[border-color:var(--lx-ring)] has-data-checked:[background-color:var(--lx-hover-wash)]",
        "*:data-[slot=field]:p-[12px]",
        className
      )}
      {...props}
    />
  )
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-label"
      className={cn(
        "flex w-fit items-center gap-[6px] text-[13px] leading-[1.2] [font-weight:550] [color:var(--lx-ink)]",
        "group-data-[disabled=true]/field:opacity-[0.55]",
        className
      )}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        "text-left text-[12px] leading-[1.45] font-normal [color:var(--lx-faint)]",
        "[&>a]:underline [&>a]:underline-offset-4",
        className
      )}
      {...props}
    />
  )
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn("relative h-[20px] text-[12px]", className)}
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" />
      {children && (
        <span
          className="relative mx-auto block w-fit px-[8px] [background-color:var(--lx-surface)] [color:var(--lx-faint)]"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  )
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>
}) {
  const content = useMemo(() => {
    if (children) {
      return children
    }

    if (!errors?.length) {
      return null
    }

    const uniqueErrors = [
      ...new Map(errors.map((error) => [error?.message, error])).values(),
    ]

    if (uniqueErrors?.length == 1) {
      return uniqueErrors[0]?.message
    }

    return (
      <ul className="ml-[16px] flex list-disc flex-col gap-[4px]">
        {uniqueErrors.map(
          (error, index) =>
            error?.message && <li key={index}>{error.message}</li>
        )}
      </ul>
    )
  }, [children, errors])

  if (!content) {
    return null
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn("text-[12px] leading-[1.45] font-normal [color:#b42318]", className)}
      {...props}
    >
      {content}
    </div>
  )
}

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
}
