import { createContext, useContext } from "react"
import type { ClubWorkspaceAdapter } from "./types"

export const WorkspaceDataContext = createContext<ClubWorkspaceAdapter | null>(null)

export function useWorkspaceData() {
  const value = useContext(WorkspaceDataContext)
  if (!value) throw new Error("useWorkspaceData must be used inside WorkspaceDataProvider.")
  return value
}
