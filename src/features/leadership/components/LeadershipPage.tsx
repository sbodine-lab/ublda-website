import { useContext, useId, type ReactNode } from "react"
import { createPortal } from "react-dom"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { LeadershipHeaderActionContext } from "../headerActionContext"

interface LeadershipPageProps {
  action?: ReactNode
  children: ReactNode
  className?: string
  title?: ReactNode
}

interface LeadershipSectionProps {
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  flush?: boolean
  title: ReactNode
  titleId?: string
}

interface LeadershipSurfaceProps {
  children: ReactNode
  className?: string
  contentClassName?: string
  flush?: boolean
}

export function LeadershipPage({
  action,
  children,
  className,
  title,
}: LeadershipPageProps) {
  const headerSlot = useContext(LeadershipHeaderActionContext)

  return (
    <div className={cn("ws-page leadership-page", className)}>
      {title ? <h2 className="leadership-page__title">{title}</h2> : null}
      {action && headerSlot ? createPortal(action, headerSlot) : null}
      {action && !headerSlot ? (
        <div className="leadership-page__action">{action}</div>
      ) : null}
      {children}
    </div>
  )
}

export function LeadershipSection({
  action,
  children,
  className,
  contentClassName,
  flush = false,
  title,
  titleId,
}: LeadershipSectionProps) {
  const generatedId = useId()
  const headingId = titleId ?? `leadership-section-${generatedId}`

  return (
    <section className={cn("leadership-section", className)} aria-labelledby={headingId}>
      <Card size="sm" className="leadership-section__card">
        <CardHeader className="leadership-section__header">
          <CardTitle id={headingId}>{title}</CardTitle>
          {action ? <CardAction>{action}</CardAction> : null}
        </CardHeader>
        <CardContent className={cn(
          "leadership-section__content",
          flush && "leadership-section__content--flush",
          contentClassName,
        )}>
          {children}
        </CardContent>
      </Card>
    </section>
  )
}

export function LeadershipSurface({
  children,
  className,
  contentClassName,
  flush = false,
}: LeadershipSurfaceProps) {
  return (
    <Card size="sm" className={cn("leadership-surface", className)}>
      <CardContent className={cn(
        "leadership-surface__content",
        flush && "leadership-surface__content--flush",
        contentClassName,
      )}>
        {children}
      </CardContent>
    </Card>
  )
}
