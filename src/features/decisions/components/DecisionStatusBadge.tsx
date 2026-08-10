import { Badge } from "@/components/ui/badge"
import { statusLabels } from "../format"
import type { DecisionStatus } from "../types"

export function DecisionStatusBadge({ status, className }: { status: DecisionStatus; className?: string }) {
  const variant = status === "open"
    ? "default"
    : status === "draft"
      ? "secondary"
      : "outline"

  return (
    <Badge variant={variant} className={className}>{statusLabels[status]}</Badge>
  )
}
