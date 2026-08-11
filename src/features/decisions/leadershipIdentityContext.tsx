import { createContext, useContext, type PropsWithChildren } from 'react'

export const LOCAL_LEADERSHIP_PREVIEW_TOKEN = 'ublda-local-leadership-preview'

export type LeadershipIdentity = {
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>
}

const LeadershipIdentityContext = createContext<LeadershipIdentity | null>(null)

export function LeadershipIdentityProvider({
  children,
  identity,
}: PropsWithChildren<{ identity: LeadershipIdentity }>) {
  return (
    <LeadershipIdentityContext.Provider value={identity}>
      {children}
    </LeadershipIdentityContext.Provider>
  )
}

// This provider and hook intentionally share one tiny context module.
// eslint-disable-next-line react-refresh/only-export-components
export function useLeadershipIdentity() {
  const identity = useContext(LeadershipIdentityContext)
  if (!identity) throw new Error('Leadership identity is unavailable outside the leadership workspace.')
  return identity
}
