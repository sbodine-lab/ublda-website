import { useSyncExternalStore, type ReactNode } from "react"
import { WorkspaceDataContext } from "./workspaceDataContext"
import type { ClubWorkspaceAdapter } from "./types"

export function WorkspaceDataProvider({
  adapter,
  children,
}: {
  adapter: ClubWorkspaceAdapter
  children: ReactNode
}) {
  useSyncExternalStore(adapter.subscribe, adapter.getSnapshot, adapter.getSnapshot)
  return <WorkspaceDataContext.Provider value={adapter}>{children}</WorkspaceDataContext.Provider>
}
