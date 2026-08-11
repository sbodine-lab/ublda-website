/**
 * Convex only needs Logto's initial session-resolution state. Logto also flips
 * `isLoading` while reading or refreshing tokens after authentication; passing
 * that transient state to Convex tears down and restarts Convex auth, creating
 * an endless token-exchange loop.
 */
export const logtoIsLoadingForConvex = (
  isLoading: boolean,
  isAuthenticated: boolean,
) => isLoading && !isAuthenticated
