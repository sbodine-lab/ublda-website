import { useEffect, useState } from 'react'

/* setTimeout truncates to a 32-bit delay, so long waits are re-armed in slices
   rather than firing immediately. */
const MAX_TIMEOUT_MS = 2_000_000_000

/* Current time, re-read once each of `boundaries` passes.

   Reading Date.now() in a component body is impure: React may re-render at any
   point, and nothing re-renders when the moment itself arrives. A tab left open
   on /join before noon would keep showing the closed state after the form went
   live. Read the clock once into state, then schedule a single wake-up for the
   next boundary that still matters. */
export function useClock(...boundaries: number[]): number {
  const [now, setNow] = useState(() => Date.now())
  // Depend on the values, not on a fresh array identity every render.
  const key = boundaries.join('|')

  useEffect(() => {
    const next = key
      .split('|')
      .map(Number)
      .filter((at) => at > now)
      .sort((a, b) => a - b)[0]
    if (next === undefined) return
    const id = window.setTimeout(() => setNow(Date.now()), Math.min(next - now, MAX_TIMEOUT_MS))
    return () => window.clearTimeout(id)
  }, [key, now])

  return now
}
