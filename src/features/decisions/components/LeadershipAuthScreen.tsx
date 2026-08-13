import { useId, type ReactNode } from "react"
import { MeshGradient } from "@paper-design/shaders-react"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"

type LeadershipAuthScreenProps = {
  title: string
  children?: ReactNode
  loading?: boolean
  preview?: boolean
  live?: "polite" | "assertive"
}

export function LeadershipAuthScreen({
  title,
  children,
  loading = false,
  preview = false,
  live,
}: LeadershipAuthScreenProps) {
  const headingId = useId()

  if (loading) {
    return (
      <main id="main-content" className="dc-auth-page">
        {preview && <Badge variant="outline" className="dc-auth-preview-pill">Local preview</Badge>}
        <div
          className="grid max-w-xs justify-items-center gap-3 text-center"
          role="status"
          aria-live={live ?? "polite"}
          aria-busy="true"
        >
          <Spinner className="size-5 text-[#142b4a]" aria-hidden="true" />
          <span className="text-sm font-medium text-[#697181]">{title}</span>
        </div>
      </main>
    )
  }

  return (
    <main id="main-content" className="dc-auth-page">
      <div className="dc-auth-shader" aria-hidden="true">
        <MeshGradient
          colors={["#071b31", "#0d203a", "#1d4d7a", "#2d5682", "#0a3e56"]}
          distortion={0.82}
          swirl={0.58}
          grainMixer={0.16}
          grainOverlay={0.08}
          speed={0.16}
          scale={1.08}
          maxPixelCount={2_600_000}
        />
      </div>
      <div className="dc-auth-shader-scrim" aria-hidden="true" />
      <section className="dc-auth-panel" aria-labelledby={headingId} aria-live={live}>
        <div className="dc-auth-panel__content">
          <div className="dc-auth-copy">
            <h1 id={headingId}>{title}</h1>
          </div>
          <div className="dc-auth-actions">
            {children}
          </div>
        </div>
      </section>
    </main>
  )
}
