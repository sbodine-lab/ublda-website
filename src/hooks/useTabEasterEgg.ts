import { useEffect } from 'react'

const AWAY_TITLE = 'See you soon 👋'
const WELCOME_TITLE = 'Welcome back 👋'

/**
 * Swaps the tab title while the page sits in a background tab. The title the
 * page was wearing on the way out is what comes back, so pages that set their
 * own title (the Decision Center) survive the round trip.
 *
 * Only someone who actually left gets welcomed back: a page that loads in a
 * background or unfocused tab becomes visible through this same event, and
 * greeting that arrival would welcome back a first-time visitor.
 */
export function useTabEasterEgg() {
  useEffect(() => {
    let pageTitle = document.title
    let timeout: ReturnType<typeof setTimeout> | undefined
    let hasLeft = false

    const isGreeting = (title: string) => title === AWAY_TITLE || title === WELCOME_TITLE

    function handleVisibilityChange() {
      clearTimeout(timeout)
      if (document.hidden) {
        if (!isGreeting(document.title)) pageTitle = document.title
        document.title = AWAY_TITLE
        hasLeft = true
        return
      }
      if (!hasLeft) return
      hasLeft = false
      document.title = WELCOME_TITLE
      timeout = setTimeout(() => {
        document.title = pageTitle
      }, 2000)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearTimeout(timeout)
      if (isGreeting(document.title)) document.title = pageTitle
    }
  }, [])
}
