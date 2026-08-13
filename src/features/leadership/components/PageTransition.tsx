import type { ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"

/**
 * Route transition for the leadership shell.
 *
 * The incoming view animates; the outgoing one is removed immediately. There is
 * no AnimatePresence and no `mode="wait"`, so navigation never waits on an exit
 * animation before showing what the user asked for.
 *
 * The key lives on this inner element rather than on `<main>` so `<main>` keeps
 * its DOM identity as the scroll and skip-link target.
 */
export function PageTransition({
  children,
  routeKey,
}: {
  children: ReactNode
  routeKey: string
}) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      key={routeKey}
      className="leadership-route"
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.18, ease: [0.2, 0, 0, 1] }}
    >
      {children}
    </motion.div>
  )
}
