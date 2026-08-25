import { useEffect } from 'react'

const AWAY_TITLE = 'See you soon 👋'
const WELCOME_TITLE = 'Welcome back 👋'
const GREETING_MS = 2000

/**
 * Flashes a greeting in the tab title on the way out and on the way back. Both
 * greetings are brief: the title the page was wearing beforehand is what comes
 * back, so pages that set their own title (the Decision Center) survive the
 * round trip. Browsers clamp timers in hidden tabs to about one tick a second,
 * so the goodbye can linger a moment longer than the welcome. Nobody is looking
 * at a tab they just left.
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

    function greet(title: string) {
      document.title = title
      timeout = setTimeout(() => {
        document.title = pageTitle
      }, GREETING_MS)
    }

    function handleVisibilityChange() {
      clearTimeout(timeout)
      if (document.hidden) {
        if (!isGreeting(document.title)) pageTitle = document.title
        hasLeft = true
        greet(AWAY_TITLE)
        return
      }
      if (!hasLeft) return
      hasLeft = false
      greet(WELCOME_TITLE)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearTimeout(timeout)
      if (isGreeting(document.title)) document.title = pageTitle
    }
  }, [])
}
