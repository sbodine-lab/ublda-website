import { useId, type ReactNode } from "react"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface LeadershipPageProps {
  action?: ReactNode
  children: ReactNode
  className?: string
  eyebrow?: ReactNode
  title?: ReactNode
}

interface LeadershipSectionProps {
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  description?: ReactNode
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
  eyebrow,
  title,
}: LeadershipPageProps) {
  const hasHeading = Boolean(eyebrow || title)

  return (
    <div className={cn("ws-page leadership-page", className)}>
      {hasHeading || action ? (
        <header className={cn(
          "leadership-page__header",
          !hasHeading && "leadership-page__header--action-only",
        )}>
          {hasHeading ? (
            <div className="leadership-page__heading">
              {eyebrow ? <p className="leadership-page__eyebrow">{eyebrow}</p> : null}
              {title ? <h2>{title}</h2> : null}
            </div>
          ) : null}
          {action ? <div className="leadership-page__action">{action}</div> : null}
        </header>
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
  description,
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
          {description ? <CardDescription>{description}</CardDescription> : null}
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
