import { ChevronLeft } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAvailabilityData } from "../availabilityDataContext"
import { AvailabilityResultsPanel } from "../components/AvailabilityResultsPanel"

export function AvailabilityResultsPage({ workspace = false }: { workspace?: boolean }) {
  const { slug } = useParams()
  const { snapshot, pollBySlug } = useAvailabilityData()
  const poll = pollBySlug(slug)
  const content = poll ? (
    <>
      <header className="av-detail-heading">
        <h1>{poll.title}</h1>
        {poll.note ? <p>{poll.note}</p> : null}
      </header>
      <AvailabilityResultsPanel poll={poll} />
    </>
  ) : snapshot.loading ? <p>loading…</p> : <h1>results not found</h1>

  if (workspace) {
    return <div className="dc-page av-workspace-results">{content}</div>
  }

  return (
    <main id="main-content" className="av-public-page av-public-results">
      <header className="av-public-topbar">
        <Link to="/scheduling" className="av-logo-lockup" aria-label="UBLDA workspace"><img src="/logo.png" alt="" /><span>UBLDA</span></Link>
        <Button variant="ghost" size="icon" asChild aria-label="back to poll"><Link to={poll ? `/s/${poll.slug}` : "/scheduling"}><ChevronLeft /></Link></Button>
      </header>
      <article className="av-public-results-document">{content}</article>
    </main>
  )
}
