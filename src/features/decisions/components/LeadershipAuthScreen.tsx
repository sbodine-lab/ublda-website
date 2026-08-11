import { useId, type ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"

type LeadershipAuthScreenProps = {
  title: string
  description?: ReactNode
  children?: ReactNode
  loading?: boolean
  preview?: boolean
  live?: "polite" | "assertive"
}

export function LeadershipAuthScreen({
  title,
  description,
  children,
  loading = false,
  preview = false,
  live,
}: LeadershipAuthScreenProps) {
  const headingId = useId()

  if (loading) {
    return (
      <main id="main-content" className="dc-auth-page">
        {preview && <Badge variant="outline" className="dc-auth-preview-pill">local preview</Badge>}
        <div
          className="grid max-w-xs justify-items-center gap-3 text-center"
          role="status"
          aria-live={live ?? "polite"}
          aria-busy="true"
        >
          <Spinner className="size-5 text-[#142b4a]" aria-hidden="true" />
          <span className="text-sm font-medium text-[#697181]">{title}</span>
          {description && <p className="text-xs text-[#697181]">{description}</p>}
        </div>
      </main>
    )
  }

  return (
    <main id="main-content" className="dc-auth-page">
      {preview && <Badge variant="outline" className="dc-auth-preview-pill">local preview</Badge>}
      <section className="dc-auth-panel" aria-labelledby={headingId} aria-live={live}>
        <a href="/" aria-label="UBLDA home" className="dc-logo-lockup dc-auth-logo">
          <img src="/logo.png" alt="" />
        </a>
        <h1 id={headingId}>{title}</h1>
        {description && <p className="dc-auth-guidance">{description}</p>}
        {children}
      </section>
    </main>
  )
}
