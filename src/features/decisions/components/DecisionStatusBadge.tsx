import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { statusLabels } from "../format"
import type { DecisionStatus } from "../types"

export function DecisionStatusBadge({ status, className }: { status: DecisionStatus; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "dc-status-badge",
        status === "open" && "dc-status-open",
        status === "draft" && "dc-status-draft",
        status === "closed" && "dc-status-closed",
        status === "finalized" && "dc-status-finalized",
        className,
      )}
    >
      <span aria-hidden="true" className="dc-status-dot" />
      {statusLabels[status]}
    </Badge>
  )
}
