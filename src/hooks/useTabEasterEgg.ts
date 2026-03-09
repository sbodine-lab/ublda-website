import { useEffect } from 'react'

const ORIGINAL_TITLE = 'UBLDA — Undergraduate Business Leaders for Diverse Abilities'
const AWAY_TITLE = 'Come back soon! \u2764\uFE0F'
const WELCOME_TITLE = 'Welcome back! \uD83D\uDC4B'

export function useTabEasterEgg() {
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>

    function handleVisibilityChange() {
      if (document.hidden) {
        document.title = AWAY_TITLE
      } else {
        document.title = WELCOME_TITLE
        timeout = setTimeout(() => {
          document.title = ORIGINAL_TITLE
        }, 2000)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearTimeout(timeout)
      document.title = ORIGINAL_TITLE
    }
  }, [])
}
